import { prisma } from '@zappy/db';
import type { Service } from '@zappy/db';
import { checkBookingRateLimit } from './rate-limit';

// Brazilian phone with DDD: 10 digits (landline, e.g. 11 3456-7890) or 11
// (mobile, e.g. 11 98765-4321) once punctuation/spaces are stripped. Not a
// full carrier-validity check — just enough to reject obviously-fake input
// ("123", "sim") before it reaches the database.
function normalizePhone(phone: string): string | null {
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
  }));
}

export async function checkAvailability(companyId: string, serviceName: string, date: string) {
  const service = await resolveService(companyId, serviceName);
  if (!service) {
    return {
      error: 'service_not_found',
      message: `Não encontrei nenhum serviço ativo chamado "${serviceName}". Chame list_services de novo para ver os nomes exatos disponíveis.`,
    };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: 'service_not_found', message: 'Empresa não encontrada.' };

  const hours = getBusinessHours(company, service);
  // Built with Date.UTC throughout — never the local Date constructor/setHours
  // — so business hours mean the same wall-clock time regardless of which
  // timezone the server process happens to run in (this dev machine reports
  // Europe/London; production is typically UTC; a customer-facing barbershop
  // is realistically America/Sao_Paulo — none of those should change the
  // result). This treats company.config.businessHours as UTC for now; real
  // per-company local timezone support is a follow-up (needs a timezone
  // library + a dashboard field, not done here).
  const [year, month, day] = date.split('-').map(Number);
  const dayStart = new Date(Date.UTC(year!, month! - 1, day!));
  const dayHours = hours[DAY_KEYS[dayStart.getUTCDay()]!];
  if (!dayHours) {
    return {
      slots: [],
      reason: 'closed_that_day',
      message: `A empresa não abre no dia ${date} (fechado nesse dia da semana). Sugira ao cliente escolher outra data.`,
    };
  }

  const [openH, openM] = dayHours[0].split(':').map(Number);
  const [closeH, closeM] = dayHours[1].split(':').map(Number);
  const openTime = new Date(Date.UTC(year!, month! - 1, day!, openH!, openM));
  const closeTime = new Date(Date.UTC(year!, month! - 1, day!, closeH!, closeM));

  const dayEnd = new Date(Date.UTC(year!, month! - 1, day!, 23, 59, 59, 999));
  const existing = await prisma.booking.findMany({
    where: { serviceId: service.id, status: 'confirmed', scheduledAt: { gte: dayStart, lte: dayEnd } },
  });

  const stepMinutes = service.durationMinutes;
  const now = Date.now();
  // Bucketed into manhã/tarde (UTC noon cutoff, same "businessHours are UTC
  // for now" simplification as the rest of this function) and capped at 3
  // each — the orchestrator turns these directly into quick-reply buttons,
  // so the customer picks a time instead of typing one back.
  const morningSlots: { time: string; iso: string }[] = [];
  const afternoonSlots: { time: string; iso: string }[] = [];
  for (
    let t = openTime.getTime();
    t + stepMinutes * 60_000 <= closeTime.getTime();
    t += stepMinutes * 60_000
  ) {
    if (t < now) continue; // no slots in the past
    const conflict = existing.some((b) => overlaps(t, stepMinutes, b.scheduledAt.getTime(), b.durationMinutes));
    if (conflict) continue;

    const d = new Date(t);
    const entry = {
      time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
      iso: d.toISOString(),
    };
    if (d.getUTCHours() < 12) {
      if (morningSlots.length < 3) morningSlots.push(entry);
    } else if (afternoonSlots.length < 3) {
      afternoonSlots.push(entry);
    }
  }

  if (morningSlots.length === 0 && afternoonSlots.length === 0) {
    return {
      serviceName: service.name,
      date,
      morningSlots: [],
      afternoonSlots: [],
      message: `Não há horários livres pra "${service.name}" no dia ${date} — todos os horários do dia já estão reservados. Sugira ao cliente escolher outra data.`,
    };
  }

  return { serviceName: service.name, date, morningSlots, afternoonSlots };
}

export async function createBooking(
  companyId: string,
  ticketId: string,
  customerId: string | null,
  args: { serviceName: string; scheduledAt: string; customerName: string; customerPhone: string },
) {
  const service = await resolveService(companyId, args.serviceName);
  if (!service) {
    return {
      error: 'service_not_found',
      message: `Não encontrei nenhum serviço ativo chamado "${args.serviceName}". Chame list_services de novo para ver os nomes exatos.`,
    };
  }

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

  // The model is supposed to echo back an exact slot from check_availability
  // (always UTC, "Z"-suffixed), but in practice it sometimes reconstructs the
  // string itself and drops the suffix — e.g. "2026-08-15T10:00:00" instead
  // of "2026-08-15T10:00:00.000Z". A naive datetime string with no
  // timezone designator is parsed by JS Date as LOCAL server time, which
  // would silently shift the booking by whatever the server's offset from
  // UTC happens to be. Since business hours are UTC-anchored throughout this
  // module (see checkAvailability), force the same interpretation here:
  // append "Z" whenever the string has no explicit offset.
  const hasExplicitOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(args.scheduledAt.trim());
  const normalizedScheduledAt = hasExplicitOffset ? args.scheduledAt : `${args.scheduledAt}Z`;

  const scheduledAt = new Date(normalizedScheduledAt);
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

  // Best-effort — persists the name/phone onto the customer record so the
  // dashboard shows a real name instead of "Anônimo" and future tickets from
  // this same person can reuse it. Never blocks the booking itself: two
  // different conversations claiming the same phone number would hit the
  // customers table's (company_id, phone) unique constraint, which is a
  // data-quality edge case, not a reason to fail the actual reservation.
  if (customerId) {
    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: { name: customerName, phone: normalizedPhone },
      });
    } catch {
      // phone already claimed by a different customer row — ignore.
    }
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        companyId,
        serviceId: service.id,
        customerId,
        ticketId,
        scheduledAt,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        notes: `Cliente: ${customerName}, Tel: ${normalizedPhone}`,
      },
    });
    return {
      success: true,
      bookingId: booking.id,
      serviceName: service.name,
      scheduledAt: booking.scheduledAt.toISOString(),
      durationMinutes: booking.durationMinutes,
      priceCents: booking.priceCents,
      requiresManualConfirmation: service.bookingMode === 'manual',
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
