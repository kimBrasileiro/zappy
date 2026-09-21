import { prisma } from '@zappigo/db';
import { getDeploymentTimezone, toWallClock, wallClockToUtc } from '../format-time';
import { DEFAULT_BUSINESS_HOURS, normalizePhone, type BusinessHours } from '../bot/services';
import { addDaysIso } from './classes';
import { saveCustomerContact } from './customers';

const SLOT_STEP_MINUTES = 30;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const ALLOWED_RESERVATION_MINUTES = [60, 90, 120] as const;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = DATE_RE.exec(iso);
  return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null;
}

function minutesOf(hhmm: string): number {
  const [hh, mm] = hhmm.split(':');
  return Number(hh ?? 0) * 60 + Number(mm ?? 0);
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function instantOf(iso: string, minutes: number, timeZone: string): Date {
  const p = parseIso(iso)!;
  return wallClockToUtc(timeZone, p.y, p.m - 1, p.d, Math.floor(minutes / 60), minutes % 60);
}

// [start, end) in minutes-of-day, for one court on one local date.
type Interval = { start: number; end: number };

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

// Everything that occupies a court on a date: class sessions (a class holds
// its court whether or not anyone enrolled, unless that day is overridden)
// and confirmed group reservations.
async function courtBusyIntervals(courtIds: string[], dateIso: string, timeZone: string): Promise<Map<string, Interval[]>> {
  const p = parseIso(dateIso)!;
  const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const dayStart = wallClockToUtc(timeZone, p.y, p.m - 1, p.d, 0);
  const nextDay = addDaysIso(dateIso, 1);
  const np = parseIso(nextDay)!;
  const dayEnd = wallClockToUtc(timeZone, np.y, np.m - 1, np.d, 0);

  const [classes, reservations] = await Promise.all([
    prisma.sportClass.findMany({
      where: { courtId: { in: courtIds }, active: true, weekday },
      include: { overrides: { where: { date: new Date(Date.UTC(p.y, p.m - 1, p.d)) }, select: { id: true } } },
    }),
    prisma.courtReservation.findMany({
      where: { courtId: { in: courtIds }, status: 'confirmed', startsAt: { gte: dayStart, lt: dayEnd } },
    }),
  ]);

  const busy = new Map<string, Interval[]>(courtIds.map((id) => [id, []]));
  for (const cls of classes) {
    if (cls.overrides.length > 0) continue;
    const start = minutesOf(cls.startTime);
    busy.get(cls.courtId)!.push({ start, end: start + cls.durationMinutes });
  }
  for (const r of reservations) {
    const local = toWallClock(timeZone, r.startsAt);
    const start = local.hour * 60 + local.minute;
    busy.get(r.courtId)!.push({ start, end: start + r.durationMinutes });
  }
  return busy;
}

function openingWindow(config: unknown, dateIso: string): Interval | null {
  const p = parseIso(dateIso)!;
  const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const hours = (config as { businessHours?: BusinessHours } | null)?.businessHours ?? DEFAULT_BUSINESS_HOURS;
  const day = hours[DAY_KEYS[weekday]!];
  if (!day) return null;
  return { start: minutesOf(day[0]), end: minutesOf(day[1]) };
}

export interface CourtFreeSlots {
  courtId: string;
  courtName: string;
  slots: string[]; // HH:MM start times
}

export async function getCourtFreeSlots(
  companyId: string,
  dateIso: string,
  options: { courtName?: string; durationMinutes?: number } = {},
): Promise<{ date: string; durationMinutes: number; closed?: boolean; courts: CourtFreeSlots[] } | { error: 'invalid_date'; message: string }> {
  if (!parseIso(dateIso)) return { error: 'invalid_date', message: 'Data inválida — use o formato YYYY-MM-DD.' };
  const timeZone = getDeploymentTimezone();
  const duration = options.durationMinutes && options.durationMinutes > 0 ? options.durationMinutes : 60;

  const [company, allCourts] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { config: true } }),
    prisma.court.findMany({ where: { companyId, active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const wanted = options.courtName ? foldName(options.courtName) : null;
  const courts = wanted ? allCourts.filter((c) => foldName(c.name).includes(wanted) || wanted.includes(foldName(c.name))) : allCourts;

  const window = openingWindow(company?.config, dateIso);
  if (!window || courts.length === 0) return { date: dateIso, durationMinutes: duration, closed: !window, courts: [] };

  const busy = await courtBusyIntervals(courts.map((c) => c.id), dateIso, timeZone);
  const now = Date.now();
  const result: CourtFreeSlots[] = courts.map((court) => {
    const slots: string[] = [];
    for (let start = window.start; start + duration <= window.end; start += SLOT_STEP_MINUTES) {
      if (instantOf(dateIso, start, timeZone).getTime() <= now) continue;
      const candidate = { start, end: start + duration };
      if (busy.get(court.id)!.some((b) => overlaps(candidate, b))) continue;
      slots.push(hhmm(start));
    }
    return { courtId: court.id, courtName: court.name, slots };
  });

  return { date: dateIso, durationMinutes: duration, courts: result };
}

function foldName(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// --- reservations -------------------------------------------------------------

export type ReserveCourtResult =
  | { success: true; reservationId: string; courtName: string; date: string; startTime: string; endTime: string; durationMinutes: number; participants: number | null }
  | {
      error: 'invalid_date' | 'invalid_time' | 'invalid_duration' | 'missing_customer_name' | 'invalid_customer_phone' | 'court_not_found' | 'slot_unavailable' | 'outside_opening_hours' | 'in_the_past';
      message: string;
    };

export async function reserveCourt(
  companyId: string,
  customerId: string | null,
  input: {
    date: string;
    startTime: string;
    durationMinutes: number;
    courtName?: string;
    participants?: number;
    customerName: string;
    customerPhone: string;
    notes?: string;
  },
): Promise<ReserveCourtResult> {
  const timeZone = getDeploymentTimezone();
  if (!parseIso(input.date)) return { error: 'invalid_date', message: 'Data inválida — use o formato YYYY-MM-DD.' };
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) return { error: 'invalid_time', message: 'Horário inválido — use HH:MM.' };
  if (!(ALLOWED_RESERVATION_MINUTES as readonly number[]).includes(input.durationMinutes)) {
    return { error: 'invalid_duration', message: 'A duração da reserva pode ser 60, 90 ou 120 minutos.' };
  }
  const name = input.customerName.trim();
  if (!name) return { error: 'missing_customer_name', message: 'Preciso do nome de quem está reservando.' };
  const phone = normalizePhone(input.customerPhone);
  if (!phone) return { error: 'invalid_customer_phone', message: 'Preciso de um telefone válido com DDD.' };

  const start = minutesOf(input.startTime);
  const startsAt = instantOf(input.date, start, timeZone);
  if (startsAt.getTime() <= Date.now()) return { error: 'in_the_past', message: 'Esse horário já passou.' };

  const [company, courts] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { config: true } }),
    prisma.court.findMany({ where: { companyId, active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const window = openingWindow(company?.config, input.date);
  const candidate = { start, end: start + input.durationMinutes };
  if (!window || candidate.start < window.start || candidate.end > window.end) {
    return { error: 'outside_opening_hours', message: 'Esse horário está fora do funcionamento do local.' };
  }

  const wanted = input.courtName ? foldName(input.courtName) : null;
  const eligible = wanted ? courts.filter((c) => foldName(c.name).includes(wanted) || wanted.includes(foldName(c.name))) : courts;
  if (eligible.length === 0) return { error: 'court_not_found', message: 'Não encontrei essa quadra.' };

  // Identity: phone-first — the reservation follows whichever Customer row
  // already owns this phone (see saveCustomerContact).
  const playerId = (await saveCustomerContact(companyId, customerId, { name, phone })).customerId;

  // Serialized per company+date so two concurrent reservations can't both
  // pass the overlap check for the same court (the partial unique index only
  // catches identical start instants, not overlapping ranges).
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId + input.date}))`;
    const busy = await courtBusyIntervals(eligible.map((c) => c.id), input.date, timeZone);
    const free = eligible.find((c) => !busy.get(c.id)!.some((b) => overlaps(candidate, b)));
    if (!free) return null;
    const reservation = await tx.courtReservation.create({
      data: {
        companyId,
        courtId: free.id,
        customerId: playerId,
        startsAt,
        durationMinutes: input.durationMinutes,
        participants: input.participants && input.participants > 0 ? Math.round(input.participants) : null,
        notes: input.notes?.trim() || null,
      },
    });
    return { reservation, courtName: free.name };
  });

  if (!outcome) {
    return {
      error: 'slot_unavailable',
      message: input.courtName
        ? 'Essa quadra não está livre nesse horário — consulte os horários livres de novo.'
        : 'Nenhuma quadra está livre nesse horário — consulte os horários livres de novo.',
    };
  }
  return {
    success: true,
    reservationId: outcome.reservation.id,
    courtName: outcome.courtName,
    date: input.date,
    startTime: input.startTime,
    endTime: hhmm(candidate.end),
    durationMinutes: input.durationMinutes,
    participants: outcome.reservation.participants,
  };
}

export interface MyReservation {
  date: string;
  startTime: string;
  durationMinutes: number;
  courtName: string;
}

export async function listMyReservations(companyId: string, customerId: string | null): Promise<MyReservation[]> {
  if (!customerId) return [];
  const timeZone = getDeploymentTimezone();
  const rows = await prisma.courtReservation.findMany({
    where: { companyId, customerId, status: 'confirmed', startsAt: { gt: new Date() } },
    include: { court: { select: { name: true } } },
    orderBy: { startsAt: 'asc' },
  });
  return rows.map((r) => {
    const local = toWallClock(timeZone, r.startsAt);
    return {
      date: `${local.year}-${String(local.month0 + 1).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`,
      startTime: hhmm(local.hour * 60 + local.minute),
      durationMinutes: r.durationMinutes,
      courtName: r.court.name,
    };
  });
}

// By date + start time, same reasoning as classes.ts#cancelEnrollment: an id
// from a previous turn's tool result can't be trusted to still be in the
// model's context.
export async function cancelReservation(
  companyId: string,
  customerId: string | null,
  input: { date: string; startTime: string },
): Promise<{ success: true } | { error: 'reservation_not_found'; message: string }> {
  const notFound = {
    error: 'reservation_not_found' as const,
    message: 'Não encontrei essa reserva para cancelar. Chame list_my_court_reservations para ver as reais.',
  };
  if (!customerId || !parseIso(input.date) || !/^\d{2}:\d{2}$/.test(input.startTime)) return notFound;
  const startsAt = instantOf(input.date, minutesOf(input.startTime), getDeploymentTimezone());
  const result = await prisma.courtReservation.updateMany({
    where: { companyId, customerId, status: 'confirmed', startsAt },
    data: { status: 'cancelled' },
  });
  return result.count > 0 ? { success: true } : notFound;
}
