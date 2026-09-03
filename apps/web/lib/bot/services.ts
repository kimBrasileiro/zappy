import { prisma } from '@zappigo/db';
import type { Service } from '@zappigo/db';
import { checkBookingRateLimit } from './rate-limit';
import { notifyBookingCancelled, notifyBookingCreated } from '../notifications';
import { getDeploymentTimezone, toWallClock, wallClockToUtc } from '../format-time';
import { createEvent, deleteEvent, getFreeBusy, isCalendarConnected } from '../google-calendar/client';
import { resolveWhatsAppCredentials } from '../whatsapp/client';

// Brazilian phone with DDD: 10 digits (landline, e.g. 11 3456-7890) or 11
// (mobile, e.g. 11 98765-4321) once punctuation/spaces are stripped. Not a
// full carrier-validity check — just enough to reject obviously-fake input
// ("123", "sim") before it reaches the database.
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

type BusinessHours = Record<string, [string, string] | null>;

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  sun: null,
  mon: ['09:00', '18:00'],
  tue: ['09:00', '18:00'],
  wed: ['09:00', '18:00'],
  thu: ['09:00', '18:00'],
  fri: ['09:00', '18:00'],
  sat: ['09:00', '18:00'],
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// A service's own businessHours (set on the dashboard) take precedence over
// the company-wide default — most services don't set one and just inherit
// the company's hours, but a service open different hours than the rest of
// the business (e.g. only weekday mornings) needs its own.
function getBusinessHours(company: { config: unknown }, service: { businessHours: unknown }): BusinessHours {
  if (service.businessHours) return service.businessHours as BusinessHours;
  const config = company.config as { businessHours?: BusinessHours } | null;
  return config?.businessHours ?? DEFAULT_BUSINESS_HOURS;
}

// Every scheduledAt returned to the model — in a tool result field or
// embedded directly in a message string — needs this alongside the raw ISO
// value. Confirmed in production: the model reads the bare UTC 'Z' instant
// and states THAT hour back to the customer a meaningful fraction of the
// time (e.g. told a customer "16:00" for a booking actually stored, and
// correctly shown on the connected Google Calendar, as 13:00 Brazil-local —
// exactly a 3h/UTC-offset misread). The ISO field can't be removed (cancel_
// booking needs the exact instant back to look the row up), so every call
// site that surfaces a time to the model now also gets this pre-converted,
// unambiguous local string to actually say out loud.
function formatLocalDateTime(d: Date): string {
  const wc = toWallClock(getDeploymentTimezone(), d);
  return `${String(wc.day).padStart(2, '0')}/${String(wc.month0 + 1).padStart(2, '0')}/${wc.year} às ${String(wc.hour).padStart(2, '0')}:${String(wc.minute).padStart(2, '0')}`;
}

function overlaps(aStart: number, aDurationMin: number, bStart: number, bDurationMin: number): boolean {
  const aEnd = aStart + aDurationMin * 60_000;
  const bEnd = bStart + bDurationMin * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

// Case- AND accent-insensitive: the model writes proper Portuguese back to
// the customer (e.g. "Avaliação Veterinária") even when the dashboard
// catalog was typed without accents ("Avaliacao Veterinaria") or vice versa
// — a plain Postgres `mode: 'insensitive'` match folds case but not
// diacritics, so that mismatch alone caused real create_booking failures.
function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Services are identified by NAME in tool calls, not by internal UUID — a
// UUID from a list_services result in one turn has no reliable way to
// survive into a later turn (conversation history is plain text; the model
// only remembers what it said, e.g. "Corte de Cabelo", never the opaque id
// alongside it). Matching by name against the company's own catalog is both
// more robust across turns and closer to how a human would resolve it.
async function resolveService(companyId: string, serviceName: string): Promise<Service | null> {
  if (!serviceName.trim()) return null;

  const target = normalizeForMatch(serviceName);
  const services = await prisma.service.findMany({ where: { companyId, active: true } });

  const exact = services.find((s) => normalizeForMatch(s.name) === target);
  if (exact) return exact;

  return (
    services.find((s) => {
      const normalizedName = normalizeForMatch(s.name);
      return normalizedName.includes(target) || target.includes(normalizedName);
    }) ?? null
  );
}

// Same fuzzy match as resolveService, applied to Service.staffNames — the
// model only ever has the name as plain text from a prior list_services/
// check_availability reply, never an id.
function resolveStaffName(service: Service, staffName: string): string | null {
  const target = normalizeForMatch(staffName);
  if (!target) return null;
  return (
    service.staffNames.find((n) => normalizeForMatch(n) === target) ??
    service.staffNames.find((n) => normalizeForMatch(n).includes(target) || target.includes(normalizeForMatch(n))) ??
    null
  );
}

function hasStaffConcept(service: Service): boolean {
  return service.staffNames.length > 0;
}

// A service can genuinely take different amounts of time depending on who
// performs it (see service.prisma's staffDurations comment) — this is the
// single source of truth every duration-sensitive call site below resolves
// through, so a staff member with no override transparently falls back to
// the service's own base duration.
function resolveStaffDuration(service: Service, staffName: string | null): number {
  if (!staffName) return service.durationMinutes;
  const overrides = service.staffDurations as Record<string, number>;
  const minutes = overrides[staffName];
  return typeof minutes === 'number' && minutes > 0 ? minutes : service.durationMinutes;
}

export async function listServices(companyId: string) {
  const services = await prisma.service.findMany({
    where: { companyId, active: true },
    orderBy: { name: 'asc' },
  });
  return services.map((s) => ({
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
    // Present only for services with a staff roster — tells the model it can
    // (and should) ask the customer's preference or pass a staffName, instead
    // of assuming a single generic provider.
    ...(s.staffNames.length > 0 ? { staffOptions: s.staffNames } : {}),
    // Only present when at least one staff member's duration actually
    // differs from durationMinutes above — most services don't override
    // anything, and repeating the same number per name would just be noise
    // the model has to read past. When present, lets the bot answer "quanto
    // tempo demora com a Ana?" correctly instead of quoting the base duration
    // for everyone.
    ...(s.staffNames.some((n) => resolveStaffDuration(s, n) !== s.durationMinutes)
      ? { staffDurationsMinutes: Object.fromEntries(s.staffNames.map((n) => [n, resolveStaffDuration(s, n)])) }
      : {}),
    // Present only when the service actually has a notice window configured
    // — most services default to 0/0 (no restriction), not worth cluttering
    // every reply with "sem multa, cancele quando quiser".
    ...(s.cancellationNoticeHours > 0
      ? {
          cancellationPolicy: `Cancelamento gratuito até ${s.cancellationNoticeHours}h antes do horário marcado${
            s.cancellationFeeCents > 0
              ? `; depois disso há multa de ${(s.cancellationFeeCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
              : ''
          }.`,
        }
      : {}),
  }));
}

export async function checkAvailability(
  companyId: string,
  serviceName: string,
  date: string,
  staffName?: string,
  time?: string,
  // Default (3) matches the bot's own use — its replies turn these straight
  // into quick-reply buttons, so more than a handful would just clutter the
  // chat. The public booking form (app/booking-actions.ts) is a real
  // date/time picker with room to show a full day's options, so it passes a
  // much higher cap instead of silently hiding slots that are actually free.
  maxPerBucket = 3,
) {
  const service = await resolveService(companyId, serviceName);
  if (!service) {
    return {
      error: 'service_not_found',
      message: `Não encontrei nenhum serviço ativo chamado "${serviceName}". Chame list_services de novo para ver os nomes exatos disponíveis.`,
    };
  }

  // Resolved once up front (rather than inline in the slot loop below) so an
  // unknown/absent name short-circuits before doing any date-math at all.
  let requestedStaff: string | null = null;
  if (hasStaffConcept(service) && staffName?.trim()) {
    requestedStaff = resolveStaffName(service, staffName);
    if (!requestedStaff) {
      return {
        error: 'unknown_staff',
        message: `Não encontrei "${staffName}" na equipe desse serviço. Profissionais disponíveis: ${service.staffNames.join(', ')}.`,
      };
    }
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: 'service_not_found', message: 'Empresa não encontrada.' };

  // Business hours ("09:00"-"18:00" etc.) are interpreted as this
  // deployment's own local wall-clock (wallClockToUtc, see
  // lib/format-time.ts), not raw UTC — no real per-company timezone support
  // exists yet, every company on a given deployment shares that
  // deployment's own timezone (DEFAULT_TIMEZONE), but treating a business's
  // own configured hours as if they were UTC meant the shop effectively
  // closed several hours earlier than anyone configuring "18:00" actually
  // intended. `dayStart` stays plain UTC midnight of this same Y/M/D — it's
  // only used below as the DATE (not datetime) key for StaffAbsence.date, a
  // @db.Date column with no time-of-day component to shift in the first
  // place.
  const [year, month, day] = date.split('-').map(Number);
  const dayStart = new Date(Date.UTC(year!, month! - 1, day!));

  // is24h bypasses both the day-of-week closed check and the open/close
  // window entirely — every day is open, 00:00 through 23:59 local time.
  let openTime: Date;
  let closeTime: Date;
  if (service.is24h) {
    openTime = wallClockToUtc(getDeploymentTimezone(), year!, month! - 1, day!, 0, 0);
    closeTime = wallClockToUtc(getDeploymentTimezone(), year!, month! - 1, day!, 23, 59);
  } else {
    const hours = getBusinessHours(company, service);
    const dayHours = hours[DAY_KEYS[dayStart.getUTCDay()]!];
    if (!dayHours) {
      return {
        serviceName: service.name,
        date,
        slots: [],
        reason: 'closed_that_day',
        message: `A empresa não abre no dia ${date} (fechado nesse dia da semana). Sugira ao cliente escolher outra data.`,
      };
    }
    const [openH, openM] = dayHours[0].split(':').map(Number);
    const [closeH, closeM] = dayHours[1].split(':').map(Number);
    openTime = wallClockToUtc(getDeploymentTimezone(), year!, month! - 1, day!, openH!, openM);
    closeTime = wallClockToUtc(getDeploymentTimezone(), year!, month! - 1, day!, closeH!, closeM);
  }

  const localDayStart = wallClockToUtc(getDeploymentTimezone(), year!, month! - 1, day!, 0, 0);
  const localDayEnd = wallClockToUtc(getDeploymentTimezone(), year!, month! - 1, day!, 23, 59, 59, 999);
  const existing = await prisma.booking.findMany({
    where: { serviceId: service.id, status: 'confirmed', scheduledAt: { gte: localDayStart, lte: localDayEnd } },
  });

  // Eligible staff for this date: the full roster minus anyone marked absent
  // (see dashboard/services/[id]'s absence list). Only computed when this
  // service actually has a staff roster — cost-free for every other service.
  let eligibleStaff: string[] = [];
  if (hasStaffConcept(service)) {
    const absences = await prisma.staffAbsence.findMany({ where: { serviceId: service.id, date: dayStart } });
    const absentStaff = new Set(absences.map((a) => a.staffName));

    if (requestedStaff) {
      if (absentStaff.has(requestedStaff)) {
        return {
          serviceName: service.name,
          date,
          slots: [],
          reason: 'staff_absent',
          message: `${requestedStaff} não está disponível no dia ${date}. Pergunte se o cliente quer outro profissional da equipe (${service.staffNames.join(', ')}) ou outra data.`,
        };
      }
      eligibleStaff = [requestedStaff];
    } else {
      eligibleStaff = service.staffNames.filter((n) => !absentStaff.has(n));
      if (eligibleStaff.length === 0) {
        return {
          serviceName: service.name,
          date,
          slots: [],
          reason: 'all_staff_absent',
          message: `Nenhum profissional está disponível no dia ${date}. Sugira ao cliente escolher outra data.`,
        };
      }
    }
  }

  // Google Calendar busy time, if the company connected one (see
  // lib/google-calendar/client.ts) — an extra blocking source on top of
  // existing bookings and staff absences, for whichever real-world events
  // the owner keeps on their own calendar that never touch this table at
  // all (e.g. an appointment booked by phone, a personal commitment).
  // Best-effort: a Google API hiccup here degrades to "just use Zappigo's
  // own bookings," not a broken availability check — same reasoning as the
  // Gemini model fallback elsewhere in this bot.
  let calendarBusy: { startMs: number; endMs: number }[] = [];
  if (isCalendarConnected(company)) {
    try {
      const busy = await getFreeBusy(company, localDayStart.toISOString(), localDayEnd.toISOString());
      calendarBusy = busy.map((b) => ({ startMs: new Date(b.start).getTime(), endMs: new Date(b.end).getTime() }));
    } catch (err) {
      console.error('[google-calendar] freebusy failed, falling back to Zappigo-only availability', err);
    }
  }

  // Self-heal stale calendar events: cancelBooking/createBooking's own
  // deleteEvent call is best-effort (a Google API failure there must never
  // undo an already-cancelled Zappigo booking), so it can leave an orphaned
  // event still "confirmed" on the real calendar — which then blocks this
  // exact slot forever, for every service, since nothing else ever retries
  // that delete. A busy interval whose start/end line up exactly with one of
  // this company's own cancelled-but-still-linked bookings is near-certainly
  // that same leftover event, not a genuine external conflict (a real
  // personal event landing on the identical minute would be an extraordinary
  // coincidence) — retry the delete and don't let it block this slot while
  // we're at it, instead of waiting for someone to notice. Awaited, not
  // fire-and-forget: Cloud Run throttles CPU once the response is sent, so a
  // detached promise here isn't reliably given the chance to finish.
  if (calendarBusy.length > 0) {
    const staleCandidates = await prisma.booking.findMany({
      where: {
        companyId,
        status: 'cancelled',
        googleCalendarEventId: { not: null },
        scheduledAt: { gte: localDayStart, lte: localDayEnd },
      },
    });
    const staleRetries: Promise<void>[] = [];
    calendarBusy = calendarBusy.filter((b) => {
      const stale = staleCandidates.find(
        (c) =>
          c.scheduledAt.getTime() === b.startMs &&
          c.scheduledAt.getTime() + c.durationMinutes * 60_000 === b.endMs,
      );
      if (!stale) return true;
      staleRetries.push(
        deleteEvent(company, stale.googleCalendarEventId!).catch((err) =>
          console.error('[google-calendar] self-heal deleteEvent retry failed', err),
        ),
      );
      return false;
    });
    await Promise.all(staleRetries);
  }

  const conflictsWithCalendar = (startMs: number, durationMin: number) => {
    const endMs = startMs + durationMin * 60_000;
    return calendarBusy.some((b) => startMs < b.endMs && b.startMs < endMs);
  };

  const now = Date.now();

  // A service can take a different amount of time depending on who performs
  // it (resolveStaffDuration) — with no specific staff requested, each
  // eligible candidate is checked against THEIR OWN duration below, not one
  // shared number. The smallest of those durations is the latest possible
  // start time anyone could still take, and is what bounds the grid loop
  // further down (a longer-duration colleague simply won't qualify for a `t`
  // that's only valid for someone quicker — checked per-candidate inside
  // evaluateSlot, not by narrowing the loop itself).
  const candidateDurations = hasStaffConcept(service)
    ? eligibleStaff.map((n) => resolveStaffDuration(service, n))
    : [service.durationMinutes];
  const minDuration = Math.min(...candidateDurations);

  // Single source of truth for "is this exact start time actually free" —
  // used both by the requested-time check below AND the preview-grid loop,
  // so they can never disagree with each other the way the old duplicated
  // logic silently could (see requestedTime handling: a customer asking for
  // a specific time that just didn't happen to be one of the top-3 preview
  // slots used to get told "unavailable" even when it was genuinely free,
  // because nothing ever actually checked *that* time — it just never made
  // it into the capped list).
  const evaluateSlot = (t: number): { ok: boolean; staffAvailable?: string[] } => {
    if (t < now) return { ok: false }; // no slots in the past

    if (hasStaffConcept(service)) {
      const free = eligibleStaff.filter((name) => {
        const dur = resolveStaffDuration(service, name);
        if (t < openTime.getTime() || t + dur * 60_000 > closeTime.getTime()) return false;
        if (conflictsWithCalendar(t, dur)) return false;
        return !existing.some((b) => b.staffName === name && overlaps(t, dur, b.scheduledAt.getTime(), b.durationMinutes));
      });
      if (free.length === 0) return { ok: false };
      return { ok: true, staffAvailable: !requestedStaff ? free : undefined };
    }

    if (t < openTime.getTime() || t + service.durationMinutes * 60_000 > closeTime.getTime()) return { ok: false };
    if (conflictsWithCalendar(t, service.durationMinutes)) return { ok: false };
    const conflict = existing.some((b) => overlaps(t, service.durationMinutes, b.scheduledAt.getTime(), b.durationMinutes));
    return { ok: !conflict };
  };

  // If the customer named a specific time ("10h"), check that exact minute
  // on its own merits instead of only ever offering whatever happened to
  // land in the capped preview list below — see evaluateSlot's comment.
  let requestedTimeResult: { time: string; available: boolean; iso?: string; staffAvailable?: string[] } | undefined;
  if (time?.trim()) {
    const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const requestedMs = wallClockToUtc(getDeploymentTimezone(), year!, month! - 1, day!, Number(match[1]), Number(match[2])).getTime();
      const result = evaluateSlot(requestedMs);
      requestedTimeResult = {
        time: `${match[1]!.padStart(2, '0')}:${match[2]}`,
        available: result.ok,
        ...(result.ok ? { iso: new Date(requestedMs).toISOString() } : {}),
        ...(result.staffAvailable ? { staffAvailable: result.staffAvailable } : {}),
      };
    }
  }

  // Appointments always START on a round grid (:00/:15/:30/:45), independent
  // of how long the service (or a given staff member's own duration) takes —
  // advancing by the duration itself (the old behavior) drifted onto
  // non-round times for any service whose duration isn't a clean divisor of
  // 60 (a 33-minute service produced 09:00, 09:33, 10:06...). Each candidate's
  // actual duration still governs how far ahead their own overlap check (and
  // close-time cutoff, both inside evaluateSlot) look — only the grid the
  // customer picks *from* is fixed.
  const SLOT_GRID_MINUTES = 15;
  const gridMs = SLOT_GRID_MINUTES * 60_000;
  // Snapped up to the grid too, in case business hours themselves were ever
  // entered as something off-grid (e.g. "09:05") — every candidate start
  // time this loop considers is a round mark, full stop.
  const firstGridStart = Math.ceil(openTime.getTime() / gridMs) * gridMs;
  // Bucketed into manhã/tarde by Brazil-local noon, capped at maxPerBucket
  // each — see the parameter's own comment above for why that cap varies by
  // caller.
  const morningSlots: { time: string; iso: string; staffAvailable?: string[] }[] = [];
  const afternoonSlots: { time: string; iso: string; staffAvailable?: string[] }[] = [];
  for (
    let t = firstGridStart;
    t + minDuration * 60_000 <= closeTime.getTime();
    t += gridMs
  ) {
    const evaluation = evaluateSlot(t);
    if (!evaluation.ok) continue;
    const staffAvailable = evaluation.staffAvailable;

    const d = new Date(t);
    const wallClock = toWallClock(getDeploymentTimezone(), d);
    const entry = {
      time: `${String(wallClock.hour).padStart(2, '0')}:${String(wallClock.minute).padStart(2, '0')}`,
      iso: d.toISOString(),
      ...(staffAvailable ? { staffAvailable } : {}),
    };
    if (wallClock.hour < 12) {
      if (morningSlots.length < maxPerBucket) morningSlots.push(entry);
    } else if (afternoonSlots.length < maxPerBucket) {
      afternoonSlots.push(entry);
    }
  }

  if (morningSlots.length === 0 && afternoonSlots.length === 0) {
    return {
      serviceName: service.name,
      date,
      morningSlots: [],
      afternoonSlots: [],
      ...(requestedTimeResult ? { requestedTimeResult } : {}),
      message: `Não há horários livres pra "${service.name}" no dia ${date} — todos os horários do dia já estão reservados. Sugira ao cliente escolher outra data.`,
    };
  }

  return { serviceName: service.name, date, morningSlots, afternoonSlots, ...(requestedTimeResult ? { requestedTimeResult } : {}) };
}

export async function createBooking(
  companyId: string,
  // Null for a booking made directly through the public company page's
  // form (app/booking-actions.ts) — there's no chat conversation to link
  // it to. Every bot-originated booking (tool-definitions.ts) still passes
  // its real ticketId.
  ticketId: string | null,
  customerId: string | null,
  args: {
    serviceName: string;
    scheduledAt: string;
    customerName: string;
    customerPhone: string;
    staffName?: string;
    confirmReplaceExisting?: boolean;
  },
) {
  const service = await resolveService(companyId, args.serviceName);
  if (!service) {
    return {
      error: 'service_not_found',
      message: `Não encontrei nenhum serviço ativo chamado "${args.serviceName}". Chame list_services de novo para ver os nomes exatos.`,
    };
  }

  // Calendar fields (needed regardless of whether this company actually has
  // Calendar connected, just to know that) plus the WhatsApp dedicated-
  // number fields, needed below for notifyBookingCreated's confirmation
  // send — cheap to fetch alongside since this is already one row.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      googleCalendarId: true,
      googleCalendarRefreshTokenEncrypted: true,
      whatsappPhoneId: true,
      whatsappTokenEncrypted: true,
    },
  });

  const customerName = args.customerName.trim();
  if (!customerName) {
    return {
      error: 'missing_customer_name',
      message: 'Nome do cliente é obrigatório para agendar. Peça o nome completo antes de tentar de novo.',
    };
  }

  const normalizedPhone = normalizePhone(args.customerPhone ?? '');
  if (!normalizedPhone) {
    return {
      error: 'invalid_customer_phone',
      message:
        'Telefone do cliente é obrigatório e precisa incluir o DDD (ex: 11 98765-4321). Peça o telefone completo antes de tentar de novo.',
    };
  }

  // Targets bot/script abuse specifically (see rate-limit.ts) — a real
  // customer booking through the chat doesn't hit either of these.
  const rl = checkBookingRateLimit(companyId, normalizedPhone);
  if (!rl.allowed) {
    return {
      error: 'rate_limited',
      message:
        rl.reason === 'too_many_bookings_this_phone'
          ? 'Esse telefone já tem vários agendamentos recentes. Peça pro cliente falar com um atendente humano para agendar mais horários.'
          : 'Muitos agendamentos foram criados recentemente. Peça pro cliente falar com um atendente humano.',
    };
  }

  // The model constructs a naive datetime string by combining this
  // deployment's own local date and the local "HH:MM" it showed the
  // customer (see the orchestrator's system prompt) — never a raw UTC
  // instant. A naive string with no timezone designator would otherwise be
  // parsed by JS Date as LOCAL SERVER time, silently shifting the booking
  // by whatever offset the server process happens to run in. Parse the
  // wall-clock components out ourselves and convert via this deployment's
  // own timezone (wallClockToUtc, DST-aware) instead of trusting `new
  // Date()`'s own naive-string handling — a fixed offset string like
  // "-03:00" would only ever be correct for a timezone with no DST.
  const hasExplicitOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(args.scheduledAt.trim());
  let scheduledAt: Date;
  if (hasExplicitOffset) {
    scheduledAt = new Date(args.scheduledAt);
  } else {
    const naive = args.scheduledAt.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    scheduledAt = naive
      ? wallClockToUtc(
          getDeploymentTimezone(),
          Number(naive[1]),
          Number(naive[2]) - 1,
          Number(naive[3]),
          Number(naive[4]),
          Number(naive[5]),
          naive[6] ? Number(naive[6]) : 0,
        )
      : new Date(NaN);
  }
  if (Number.isNaN(scheduledAt.getTime())) {
    return {
      error: 'invalid_datetime',
      message: 'A data/hora informada não é válida. Use o formato ISO 8601 exato retornado por check_availability.',
    };
  }

  // Re-check availability right before insert — the window between
  // check_availability and create_booking is where a race could double-book.
  const sameDay = await prisma.booking.findMany({
    where: {
      serviceId: service.id,
      status: 'confirmed',
      scheduledAt: {
        gte: new Date(scheduledAt.getTime() - 24 * 60 * 60_000),
        lte: new Date(scheduledAt.getTime() + 24 * 60 * 60_000),
      },
    },
  });

  // Which name (if any) this booking ends up assigned to. Stays null for
  // services with no staff roster — same shared-pool conflict check as
  // before staff support existed.
  let assignedStaff: string | null = null;

  if (hasStaffConcept(service)) {
    // StaffAbsence.date is a plain @db.Date keyed by Brazil-local calendar
    // day — extracting it via getUTCFullYear/etc. straight off scheduledAt
    // (a real UTC instant) would misfire for a booking within 3h of UTC
    // midnight, e.g. 22:00 Brazil-local is already the next UTC day.
    const brazilDate = toWallClock(getDeploymentTimezone(), scheduledAt);
    const dayStart = new Date(Date.UTC(brazilDate.year, brazilDate.month0, brazilDate.day));
    const absences = await prisma.staffAbsence.findMany({ where: { serviceId: service.id, date: dayStart } });
    const absentStaff = new Set(absences.map((a) => a.staffName));

    const conflictsFor = (name: string) =>
      sameDay.some(
        (b) => b.staffName === name && overlaps(scheduledAt.getTime(), resolveStaffDuration(service, name), b.scheduledAt.getTime(), b.durationMinutes),
      );

    if (args.staffName?.trim()) {
      const requested = resolveStaffName(service, args.staffName);
      if (!requested) {
        return {
          error: 'unknown_staff',
          message: `Não encontrei "${args.staffName}" na equipe desse serviço. Profissionais disponíveis: ${service.staffNames.join(', ')}.`,
        };
      }
      if (absentStaff.has(requested)) {
        return {
          error: 'staff_absent',
          message: `${requested} não está disponível nesse dia. Pergunte se o cliente quer outro profissional ou outra data — nunca troque de profissional sem perguntar.`,
        };
      }
      if (conflictsFor(requested)) {
        // Deliberately does NOT fall back to another staff member on its
        // own — the customer asked for this specific person, so the bot has
        // to offer alternatives and let them choose, not silently reassign.
        const otherFree = service.staffNames.filter((n) => n !== requested && !absentStaff.has(n) && !conflictsFor(n));
        return {
          error: 'slot_unavailable',
          message:
            otherFree.length > 0
              ? `${requested} já está ocupado(a) nesse horário. ${otherFree.join(', ')} está(ão) livre(s) nesse mesmo horário — pergunte se o cliente aceita trocar de profissional, ou chame check_availability de novo pra outros horários com ${requested}.`
              : `${requested} já está ocupado(a) nesse horário e não há outro profissional livre no mesmo horário — chame check_availability de novo pra oferecer outros horários.`,
        };
      }
      assignedStaff = requested;
    } else {
      // Customer has no preference ("tanto faz") — auto-allocate among
      // whoever's free at this exact time, favoring whoever has the fewest
      // bookings that day so it doesn't pile everything onto the first name
      // in the list (a light round-robin, not a real fairness algorithm).
      const free = service.staffNames.filter((n) => !absentStaff.has(n) && !conflictsFor(n));
      if (free.length === 0) {
        return {
          error: 'slot_unavailable',
          message:
            'Esse horário específico já está reservado por outro cliente com todos os profissionais disponíveis — chame check_availability de novo pra oferecer outros horários livres.',
        };
      }
      const countForDay = (name: string) => sameDay.filter((b) => b.staffName === name).length;
      assignedStaff = free.reduce((best, n) => (countForDay(n) < countForDay(best) ? n : best), free[0]!);
    }
  } else {
    const hasConflict = sameDay.some((b) =>
      overlaps(scheduledAt.getTime(), service.durationMinutes, b.scheduledAt.getTime(), b.durationMinutes),
    );
    if (hasConflict) {
      return {
        error: 'slot_unavailable',
        message:
          'Esse horário específico já está reservado por outro cliente (não é que a empresa esteja fechada) — chame check_availability de novo pra oferecer outros horários livres nesse mesmo dia.',
      };
    }
  }

  // Persists the name/phone onto the customer record so the dashboard shows
  // a real name instead of "Anônimo" and future tickets from this same
  // person can reuse it. A different conversation/session claiming the same
  // phone number hits the customers table's (company_id, phone) unique
  // constraint — in that case the pre-existing row IS this customer's real
  // identity, so the booking is re-pointed to it instead of staying linked
  // to a blank duplicate.
  let effectiveCustomerId = customerId;
  if (customerId) {
    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: { name: customerName, phone: normalizedPhone },
      });
    } catch (err) {
      // instanceof Prisma.PrismaClientKnownRequestError is unreliable here:
      // Next.js transpiles @zappigo/db separately from how the Prisma engine's
      // own runtime resolves @prisma/client, so the thrown error and the
      // imported class can end up as different module instances. Checking
      // the error code directly sidesteps that entirely.
      if ((err as { code?: string }).code === 'P2002') {
        const existing = await prisma.customer.findFirst({ where: { companyId, phone: normalizedPhone } });
        if (existing) effectiveCustomerId = existing.id;
      } else {
        throw err;
      }
    }
  }

  // No separate "reschedule" tool — the model always calls create_booking —
  // but it must never SILENTLY replace an existing appointment; the
  // customer has to actually say they want that. Scoped to this same
  // customer+service and still in the future (a past "confirmed" booking
  // already happened — see dashboard/bookings' attended/no-show marking —
  // cancelling it here would misrepresent history, not fix a double-booking).
  let rescheduledFrom: string | null = null;
  if (effectiveCustomerId) {
    const previous = await prisma.booking.findMany({
      where: {
        companyId,
        serviceId: service.id,
        customerId: effectiveCustomerId,
        status: 'confirmed',
        scheduledAt: { gt: new Date() },
      },
    });
    if (previous.length > 0 && !args.confirmReplaceExisting) {
      return {
        error: 'existing_booking_conflict',
        existingBooking: {
          serviceName: service.name,
          scheduledAt: previous[0]!.scheduledAt.toISOString(),
          // Say THIS to the customer, never the scheduledAt above — that one
          // is UTC (always 3h off Brazil time) and exists only so a
          // follow-up create_booking(confirmReplaceExisting: true) call can
          // reference the exact instant.
          scheduledAtLocal: formatLocalDateTime(previous[0]!.scheduledAt),
        },
        message: `Esse cliente já tem um agendamento CONFIRMADO de ${service.name} para ${formatLocalDateTime(previous[0]!.scheduledAt)} (horário de Brasília) — NÃO crie o novo agendamento ainda. Lembre o cliente desse agendamento existente, dizendo exatamente esse horário de Brasília (nunca o campo scheduledAt em UTC), e pergunte explicitamente: ele quer REAGENDAR esse agendamento pro novo horário (nesse caso, chame create_booking de novo com os mesmos dados E confirmReplaceExisting: true, só depois que ele confirmar), ou prefere MANTER o agendamento antigo como está (nesse caso não chame create_booking de novo agora)? Nunca assuma a resposta.`,
      };
    }
    if (previous.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: previous.map((b) => b.id) } },
        data: { status: 'cancelled' },
      });
      // Display-only (nothing re-parses this), so it goes straight to the
      // Brazil-local string — no reason to hand the model a UTC value here
      // it would only have to convert and might misread, same fix as
      // scheduledAtLocal above.
      rescheduledFrom = formatLocalDateTime(previous[0]!.scheduledAt);

      if (company && isCalendarConnected(company)) {
        for (const b of previous) {
          if (!b.googleCalendarEventId) continue;
          try {
            await deleteEvent(company, b.googleCalendarEventId);
          } catch (err) {
            console.error('[google-calendar] deleteEvent failed during reschedule', err);
          }
        }
      }
    }
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        companyId,
        serviceId: service.id,
        customerId: effectiveCustomerId,
        ticketId,
        scheduledAt,
        durationMinutes: resolveStaffDuration(service, assignedStaff),
        priceCents: service.priceCents,
        staffName: assignedStaff,
        notes: `Cliente: ${customerName}, Tel: ${normalizedPhone}`,
      },
    });

    // Best-effort, same reasoning as the freebusy check in checkAvailability
    // above — a Google API failure here must never undo a booking that's
    // already confirmed in Zappigo's own table. Only actually runs when this
    // company connected a calendar; free for everyone else.
    if (company && isCalendarConnected(company)) {
      try {
        const eventId = await createEvent(company, {
          summary: `${service.name} — ${customerName}`,
          description: `Agendado via Zappigo. Cliente: ${customerName}, Tel: ${normalizedPhone}.`,
          startIso: booking.scheduledAt.toISOString(),
          endIso: new Date(booking.scheduledAt.getTime() + booking.durationMinutes * 60_000).toISOString(),
        });
        await prisma.booking.update({ where: { id: booking.id }, data: { googleCalendarEventId: eventId } });
      } catch (err) {
        console.error('[google-calendar] createEvent failed, booking stays confirmed in Zappigo only', err);
      }
    }

    const requiresManualConfirmation = service.bookingMode === 'manual';
    await notifyBookingCreated({
      companyId,
      serviceName: service.name,
      scheduledAt: booking.scheduledAt,
      customerName,
      customerPhone: normalizedPhone,
      requiresManualConfirmation,
      whatsappCredentials: resolveWhatsAppCredentials(company ?? { whatsappPhoneId: null, whatsappTokenEncrypted: null }),
    });

    return {
      success: true,
      bookingId: booking.id,
      serviceName: service.name,
      // Deliberately NOT returning a raw UTC `scheduledAt` field here, only
      // this local one — the system prompt already tells the model "never
      // read scheduledAt, always read scheduledAtLocal" (see orchestrator.ts),
      // but that instruction doesn't always hold: eval/scenarios/support-flows
      // .json's reschedule_flow caught the model quoting the raw UTC hour to
      // the customer despite it (up to a 3h-off confirmation). Nothing reads
      // a raw scheduledAt back out of THIS specific result downstream (not
      // orchestrator.ts's own post-processing, not a later tool call — the
      // documented pattern for e.g. cancel_booking is to call list_bookings
      // first for a canonical Z-suffixed instant, not reuse this one), so
      // removing the ambiguous field entirely is strictly safer than hoping
      // the instruction holds every time.
      scheduledAtLocal: formatLocalDateTime(booking.scheduledAt),
      durationMinutes: booking.durationMinutes,
      priceCents: booking.priceCents,
      requiresManualConfirmation,
      // Present only for services with a staff roster — tell the customer
      // who they're booked with, especially important when they said "tanto
      // faz" and the auto-allocation picked for them.
      ...(assignedStaff ? { staffName: assignedStaff } : {}),
      // Present only when this call replaced an existing future booking for
      // the same customer+service — see lib/bot/orchestrator.ts's system
      // prompt for how this changes the confirmation wording.
      rescheduledFrom,
    };
  } catch {
    // idx_bookings_no_double_book caught a race the check above missed.
    return {
      error: 'slot_unavailable',
      message:
        'Esse horário acabou de ser reservado por outro cliente nesse exato instante — chame check_availability de novo pra oferecer outros horários livres.',
    };
  }
}

// Rescheduling has no separate tool (see createBooking's rescheduledFrom
// logic above) — this pair is only for a cancellation the customer does NOT
// want replaced with a new time.
export async function listBookings(companyId: string, customerId: string | null) {
  if (!customerId) {
    return {
      bookings: [],
      message: 'Ainda não tenho o telefone confirmado do cliente — peça o telefone completo com DDD antes de buscar agendamentos.',
    };
  }

  const bookings = await prisma.booking.findMany({
    where: { companyId, customerId, status: 'confirmed', scheduledAt: { gt: new Date() } },
    include: { service: true },
    orderBy: { scheduledAt: 'asc' },
  });

  if (bookings.length === 0) {
    return { bookings: [], message: 'Esse cliente não tem nenhum agendamento futuro confirmado.' };
  }

  return {
    bookings: bookings.map((b) => ({
      serviceName: b.service.name,
      scheduledAt: b.scheduledAt.toISOString(),
      // Say this one, not scheduledAt (UTC) — see formatBrazilDateTime.
      scheduledAtLocal: formatLocalDateTime(b.scheduledAt),
      ...(b.staffName ? { staffName: b.staffName } : {}),
    })),
  };
}

export async function cancelBooking(
  companyId: string,
  customerId: string | null,
  args: { serviceName: string; scheduledAt: string },
) {
  if (!customerId) {
    return {
      error: 'missing_customer',
      message: 'Ainda não tenho o telefone confirmado do cliente — peça o telefone completo com DDD antes de cancelar.',
    };
  }

  // list_bookings always returns an explicit "Z"-suffixed instant (via
  // toISOString()), so this fallback only matters if the model retypes the
  // string itself — same DST-safe wall-clock parse as createBooking above
  // (a fixed "-03:00" suffix would be wrong half the year on .es/Madrid).
  const hasExplicitOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(args.scheduledAt.trim());
  let scheduledAt: Date;
  if (hasExplicitOffset) {
    scheduledAt = new Date(args.scheduledAt);
  } else {
    const naive = args.scheduledAt.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    scheduledAt = naive
      ? wallClockToUtc(
          getDeploymentTimezone(),
          Number(naive[1]),
          Number(naive[2]) - 1,
          Number(naive[3]),
          Number(naive[4]),
          Number(naive[5]),
          naive[6] ? Number(naive[6]) : 0,
        )
      : new Date(NaN);
  }
  if (Number.isNaN(scheduledAt.getTime())) {
    return {
      error: 'invalid_datetime',
      message: 'A data/hora informada não é válida. Use o formato ISO 8601 exato retornado por list_bookings.',
    };
  }

  const service = await resolveService(companyId, args.serviceName);
  if (!service) {
    return {
      error: 'service_not_found',
      message: `Não encontrei nenhum serviço ativo chamado "${args.serviceName}". Chame list_bookings de novo pra ver os agendamentos exatos.`,
    };
  }

  const booking = await prisma.booking.findFirst({
    where: { companyId, customerId, serviceId: service.id, status: 'confirmed', scheduledAt },
  });
  if (!booking) {
    return {
      error: 'booking_not_found',
      message: 'Não encontrei esse agendamento confirmado pra esse cliente — chame list_bookings de novo e use exatamente o serviceName e scheduledAt retornados.',
    };
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } });
  await notifyBookingCancelled({ companyId, serviceName: service.name, scheduledAt: booking.scheduledAt });

  if (booking.googleCalendarEventId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { googleCalendarId: true, googleCalendarRefreshTokenEncrypted: true },
    });
    if (company && isCalendarConnected(company)) {
      try {
        await deleteEvent(company, booking.googleCalendarEventId);
      } catch (err) {
        console.error('[google-calendar] deleteEvent failed on cancel', err);
      }
    }
  }

  const hoursUntil = (scheduledAt.getTime() - Date.now()) / 3_600_000;
  const withinFeeWindow = service.cancellationNoticeHours > 0 && hoursUntil < service.cancellationNoticeHours;

  return {
    success: true,
    serviceName: service.name,
    scheduledAt: booking.scheduledAt.toISOString(),
    // Say this one, not scheduledAt (UTC) — see formatBrazilDateTime.
    scheduledAtLocal: formatLocalDateTime(booking.scheduledAt),
    // Purely informational — there's no in-chat payment collection, so the
    // bot can only tell the customer a fee may apply per the company's
    // policy, never actually charge it.
    ...(withinFeeWindow && service.cancellationFeeCents > 0
      ? {
          feeMayApply: true,
          feeMessage: `Esse cancelamento está dentro do prazo de multa (menos de ${service.cancellationNoticeHours}h de antecedência) — pode haver cobrança de ${(service.cancellationFeeCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, conforme a política da empresa.`,
        }
      : {}),
  };
}
