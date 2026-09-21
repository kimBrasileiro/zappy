import { prisma } from '@zappigo/db';
import { getDeploymentTimezone, wallClockToUtc } from '../format-time';
import { normalizePhone } from '../bot/services';
import { saveCustomerContact } from './customers';
import {
  LEVEL_LABELS,
  SPORT_LABELS,
  isLevel,
  isSport,
  resolveLevel,
  resolveSport,
  type Level,
  type Sport,
} from './constants';

const DAY_MS = 24 * 60 * 60_000;
const MAX_RANGE_DAYS = 31;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// --- date helpers (all in THIS deployment's local calendar, see
// lib/format-time.ts — a class's startTime is wall-clock, like Booking) ------

export function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const match = DATE_RE.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

// Prisma maps a @db.Date column to a JS Date at UTC midnight of that day.
export function dateColumnValue(iso: string): Date {
  const p = parseIsoDate(iso)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

export function isoOfDateColumn(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function weekdayOf(iso: string): number {
  const p = parseIsoDate(iso)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function todayIso(timeZone: string = getDeploymentTimezone()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

export function addDaysIso(iso: string, days: number): string {
  const p = parseIsoDate(iso)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d) + days * DAY_MS).toISOString().slice(0, 10);
}

function sessionStartInstant(iso: string, startTime: string, timeZone: string): Date {
  const p = parseIsoDate(iso)!;
  const [hh, mm] = startTime.split(':');
  return wallClockToUtc(timeZone, p.y, p.m - 1, p.d, Number(hh ?? 0), Number(mm ?? 0));
}

export function addMinutesToTime(startTime: string, minutes: number): string {
  const [hh, mm] = startTime.split(':');
  const total = Number(hh ?? 0) * 60 + Number(mm ?? 0) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(':');
  return Number(hh ?? 0) * 60 + Number(mm ?? 0);
}

function whenLabel(startsAt: Date, startTime: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone,
  }).format(startsAt);
  return `${day} às ${startTime}`;
}

// --- sessions ---------------------------------------------------------------

export interface ClassSession {
  classId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM local
  endTime: string;
  startsAtIso: string;
  whenLabel: string;
  courtId: string;
  courtName: string;
  sport: Sport;
  sportLabel: string;
  level: Level;
  levelLabel: string;
  durationMinutes: number;
  capacity: number;
  seatsLeft: number;
  priceCents: number;
  instructorName: string | null;
  // The customer's own declared level for THIS sport matches this class's
  // level — what the bot/form lead with. False when the level is unknown.
  matchesPlayerLevel: boolean;
}

export async function getPlayerLevels(companyId: string, customerId: string | null): Promise<Partial<Record<Sport, Level>>> {
  if (!customerId) return {};
  const rows = await prisma.customerSportLevel.findMany({ where: { companyId, customerId } });
  const levels: Partial<Record<Sport, Level>> = {};
  for (const row of rows) {
    if (isSport(row.sport) && isLevel(row.level)) levels[row.sport] = row.level;
  }
  return levels;
}

// Expands the weekly grid into dated sessions for [fromDate, toDate]
// (inclusive, YYYY-MM-DD, this deployment's local calendar): weekday match,
// minus days with a ClassSessionOverride, minus anything already started.
export async function listClassSessions(args: {
  companyId: string;
  fromDate: string;
  toDate: string;
  sport?: Sport;
  level?: Level;
  customerId?: string | null;
  limit?: number;
}): Promise<{ sessions: ClassSession[]; playerLevels: Partial<Record<Sport, Level>> }> {
  const timeZone = getDeploymentTimezone();
  const from = parseIsoDate(args.fromDate);
  const to = parseIsoDate(args.toDate);
  if (!from || !to || args.toDate < args.fromDate) return { sessions: [], playerLevels: {} };

  // Bounded so a runaway range (bad tool argument) can't fan out into
  // thousands of expanded sessions.
  const lastDate = addDaysIso(args.fromDate, MAX_RANGE_DAYS - 1);
  const toDate = args.toDate > lastDate ? lastDate : args.toDate;

  const classes = await prisma.sportClass.findMany({
    where: {
      companyId: args.companyId,
      active: true,
      court: { active: true },
      ...(args.sport ? { sport: args.sport } : {}),
      ...(args.level ? { level: args.level } : {}),
    },
    include: { court: { select: { name: true, sortOrder: true } } },
  });
  if (classes.length === 0) return { sessions: [], playerLevels: {} };

  const classIds = classes.map((c) => c.id);
  const [overrides, enrollmentCounts, playerLevels] = await Promise.all([
    prisma.classSessionOverride.findMany({
      where: { classId: { in: classIds }, date: { gte: dateColumnValue(args.fromDate), lte: dateColumnValue(toDate) } },
      select: { classId: true, date: true },
    }),
    prisma.classEnrollment.groupBy({
      by: ['classId', 'date'],
      where: {
        classId: { in: classIds },
        status: 'confirmed',
        date: { gte: dateColumnValue(args.fromDate), lte: dateColumnValue(toDate) },
      },
      _count: { _all: true },
    }),
    getPlayerLevels(args.companyId, args.customerId ?? null),
  ]);

  const overridden = new Set(overrides.map((o) => `${o.classId}|${isoOfDateColumn(o.date)}`));
  const taken = new Map(enrollmentCounts.map((e) => [`${e.classId}|${isoOfDateColumn(e.date)}`, e._count._all]));

  const now = Date.now();
  const sessions: ClassSession[] = [];
  for (let date = args.fromDate; date <= toDate; date = addDaysIso(date, 1)) {
    const weekday = weekdayOf(date);
    for (const cls of classes) {
      if (cls.weekday !== weekday) continue;
      const key = `${cls.id}|${date}`;
      if (overridden.has(key)) continue;
      const startsAt = sessionStartInstant(date, cls.startTime, timeZone);
      if (startsAt.getTime() <= now) continue;
      if (!isSport(cls.sport) || !isLevel(cls.level)) continue;

      sessions.push({
        classId: cls.id,
        date,
        startTime: cls.startTime,
        endTime: addMinutesToTime(cls.startTime, cls.durationMinutes),
        startsAtIso: startsAt.toISOString(),
        whenLabel: whenLabel(startsAt, cls.startTime, timeZone),
        courtId: cls.courtId,
        courtName: cls.court.name,
        sport: cls.sport,
        sportLabel: SPORT_LABELS[cls.sport],
        level: cls.level,
        levelLabel: LEVEL_LABELS[cls.level],
        durationMinutes: cls.durationMinutes,
        capacity: cls.capacity,
        seatsLeft: Math.max(0, cls.capacity - (taken.get(key) ?? 0)),
        priceCents: cls.priceCents,
        instructorName: cls.instructorName,
        matchesPlayerLevel: playerLevels[cls.sport] === cls.level,
      });
    }
  }

  sessions.sort((a, b) => (a.startsAtIso === b.startsAtIso ? a.courtName.localeCompare(b.courtName) : a.startsAtIso < b.startsAtIso ? -1 : 1));
  return { sessions: sessions.slice(0, args.limit ?? 40), playerLevels };
}

// --- player profile -----------------------------------------------------------

export async function saveSportLevel(companyId: string, customerId: string, sport: Sport, level: Level) {
  await prisma.customerSportLevel.upsert({
    where: { customerId_sport: { customerId, sport } },
    create: { companyId, customerId, sport, level },
    update: { level },
  });
}

// "18:00", "18h", "18h30", "18" → "18:00" / "18:30".
export function normalizeStartTime(text: string): string | null {
  const match = /^\s*(\d{1,2})(?:\s*[:h]\s*(\d{2})?)?\s*(?:h|hs|horas)?\s*$/i.exec(text);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = match[2] ? Number(match[2]) : 0;
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// The bot never carries opaque ids across turns (tool results don't survive
// in conversation history — see ticket-metadata.ts), so a class is named the
// way a person would: sport + level + date + start time (+ court when two
// courts run the same class at once).
export async function resolveClassForEnrollment(
  companyId: string,
  input: { sport: string; level: string; date: string; startTime: string; courtName?: string },
): Promise<{ classId: string } | { error: 'invalid_input' | 'class_not_found' | 'ambiguous_class'; message: string; courts?: string[] }> {
  const sport = resolveSport(input.sport);
  const level = resolveLevel(input.level);
  const startTime = normalizeStartTime(input.startTime);
  if (!sport || !level || !startTime || !parseIsoDate(input.date)) {
    return { error: 'invalid_input', message: 'Preciso do esporte, nível, data (YYYY-MM-DD) e horário de início exatos da aula, como retornados por list_class_sessions.' };
  }

  const candidates = await prisma.sportClass.findMany({
    where: { companyId, active: true, court: { active: true }, sport, level, weekday: weekdayOf(input.date), startTime },
    include: { court: { select: { name: true } } },
  });
  const wanted = input.courtName ? input.courtName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() : null;
  const matches = wanted
    ? candidates.filter((c) => {
        const n = c.court.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        return n.includes(wanted) || wanted.includes(n);
      })
    : candidates;

  if (matches.length === 0) {
    return { error: 'class_not_found', message: 'Não existe essa aula nesse dia e horário. Chame list_class_sessions de novo para ver as aulas reais.' };
  }
  if (matches.length > 1) {
    return {
      error: 'ambiguous_class',
      message: 'Há mais de uma quadra com essa aula nesse horário — pergunte em qual quadra o aluno prefere e passe courtName.',
      courts: matches.map((m) => m.court.name),
    };
  }
  return { classId: matches[0]!.id };
}

// --- enrollment -------------------------------------------------------------

export type EnrollResult =
  | { success: true; enrollmentId: string; session: ClassSession; playerLevel: Level | null }
  | {
      error:
        | 'invalid_date'
        | 'class_not_found'
        | 'session_unavailable'
        | 'session_in_past'
        | 'class_full'
        | 'already_enrolled'
        | 'time_conflict'
        | 'missing_customer_name'
        | 'invalid_customer_phone';
      message: string;
      alternatives?: ClassSession[];
    };

export async function enrollInClass(
  companyId: string,
  customerId: string | null,
  input: {
    classId: string;
    date: string;
    customerName: string;
    customerPhone: string;
    // The player's level for THIS class's sport — saved to their profile so
    // future recommendations start from it.
    playerLevel?: Level;
  },
): Promise<EnrollResult> {
  const timeZone = getDeploymentTimezone();
  if (!parseIsoDate(input.date)) return { error: 'invalid_date', message: 'Data inválida — use o formato YYYY-MM-DD.' };
  const name = input.customerName.trim();
  if (!name) return { error: 'missing_customer_name', message: 'Preciso do nome completo do aluno para reservar a vaga.' };
  const phone = normalizePhone(input.customerPhone);
  if (!phone) return { error: 'invalid_customer_phone', message: 'Preciso de um telefone válido com DDD.' };

  const cls = await prisma.sportClass.findFirst({
    where: { id: input.classId, companyId, active: true, court: { active: true } },
    include: { court: { select: { name: true } } },
  });
  if (!cls || !isSport(cls.sport) || !isLevel(cls.level)) {
    return { error: 'class_not_found', message: 'Não encontrei essa aula. Consulte as aulas disponíveis de novo.' };
  }
  if (weekdayOf(input.date) !== cls.weekday) {
    return { error: 'session_unavailable', message: 'Essa aula não acontece nesse dia da semana.' };
  }
  const startsAt = sessionStartInstant(input.date, cls.startTime, timeZone);
  if (startsAt.getTime() <= Date.now()) {
    return { error: 'session_in_past', message: 'Essa aula já começou ou já passou.' };
  }
  const overridden = await prisma.classSessionOverride.findUnique({
    where: { classId_date: { classId: cls.id, date: dateColumnValue(input.date) } },
  });
  if (overridden) {
    return { error: 'session_unavailable', message: 'Essa aula foi cancelada nesse dia.' };
  }

  const playerId = (await saveCustomerContact(companyId, customerId, { name, phone })).customerId;
  const dateValue = dateColumnValue(input.date);
  const startMin = timeToMinutes(cls.startTime);
  const endMin = startMin + cls.durationMinutes;

  // The seat check + insert run under a row lock on the class: two people
  // taking the last seat at the same instant must not both succeed. Same
  // "re-check inside the write" principle as createBooking, with FOR UPDATE
  // doing the serialization the partial unique index can't (capacity > 1).
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sport_classes WHERE id = ${cls.id}::uuid FOR UPDATE`;

    // Already-enrolled is checked BEFORE full: someone who already holds a
    // seat in a now-full class should hear "you're already in", not "full".
    const already = await tx.classEnrollment.findFirst({
      where: { classId: cls.id, date: dateValue, customerId: playerId, status: 'confirmed' },
    });
    if (already) return { error: 'already_enrolled' as const };

    const taken = await tx.classEnrollment.count({ where: { classId: cls.id, date: dateValue, status: 'confirmed' } });
    if (taken >= cls.capacity) return { error: 'class_full' as const };

    // The same person can't be in two overlapping classes on one day.
    const sameDay = await tx.classEnrollment.findMany({
      where: { customerId: playerId, date: dateValue, status: 'confirmed' },
      include: { class: { select: { startTime: true, durationMinutes: true } } },
    });
    const clash = sameDay.some((e) => {
      const s = timeToMinutes(e.class.startTime);
      return startMin < s + e.class.durationMinutes && s < endMin;
    });
    if (clash) return { error: 'time_conflict' as const };

    const enrollment = await tx.classEnrollment.create({
      data: { companyId, classId: cls.id, customerId: playerId, date: dateValue, priceCents: cls.priceCents },
    });
    return { enrollmentId: enrollment.id, seatsLeftAfter: cls.capacity - taken - 1 };
  });

  if ('error' in outcome) {
    if (outcome.error === 'class_full') {
      const { sessions } = await listClassSessions({
        companyId,
        fromDate: input.date,
        toDate: addDaysIso(input.date, 14),
        sport: cls.sport,
        level: cls.level,
        customerId: playerId,
        limit: 6,
      });
      return {
        error: 'class_full',
        message: 'Essa turma já está lotada nesse dia.',
        alternatives: sessions.filter((s) => s.seatsLeft > 0 && !(s.classId === cls.id && s.date === input.date)).slice(0, 4),
      };
    }
    if (outcome.error === 'already_enrolled') {
      return { error: 'already_enrolled', message: 'Esse aluno já tem vaga nessa aula.' };
    }
    return { error: 'time_conflict', message: 'O aluno já tem outra aula nesse mesmo horário.' };
  }

  if (input.playerLevel) await saveSportLevel(companyId, playerId, cls.sport, input.playerLevel);
  const levels = await getPlayerLevels(companyId, playerId);

  return {
    success: true,
    enrollmentId: outcome.enrollmentId,
    playerLevel: levels[cls.sport] ?? null,
    session: {
      classId: cls.id,
      date: input.date,
      startTime: cls.startTime,
      endTime: addMinutesToTime(cls.startTime, cls.durationMinutes),
      startsAtIso: startsAt.toISOString(),
      whenLabel: whenLabel(startsAt, cls.startTime, timeZone),
      courtId: cls.courtId,
      courtName: cls.court.name,
      sport: cls.sport,
      sportLabel: SPORT_LABELS[cls.sport],
      level: cls.level,
      levelLabel: LEVEL_LABELS[cls.level],
      durationMinutes: cls.durationMinutes,
      capacity: cls.capacity,
      seatsLeft: outcome.seatsLeftAfter,
      priceCents: cls.priceCents,
      instructorName: cls.instructorName,
      matchesPlayerLevel: levels[cls.sport] === cls.level,
    },
  };
}

// --- my enrollments / cancel ---------------------------------------------------

export interface MyEnrollment {
  date: string;
  startTime: string;
  whenLabel: string;
  courtName: string;
  sportLabel: string;
  levelLabel: string;
  priceCents: number;
}

export async function listMyEnrollments(companyId: string, customerId: string | null): Promise<MyEnrollment[]> {
  if (!customerId) return [];
  const timeZone = getDeploymentTimezone();
  const rows = await prisma.classEnrollment.findMany({
    where: { companyId, customerId, status: 'confirmed', date: { gte: dateColumnValue(todayIso(timeZone)) } },
    include: { class: { include: { court: { select: { name: true } } } } },
    orderBy: { date: 'asc' },
  });

  const now = Date.now();
  const result: MyEnrollment[] = [];
  for (const row of rows) {
    const date = isoOfDateColumn(row.date);
    const startsAt = sessionStartInstant(date, row.class.startTime, timeZone);
    if (startsAt.getTime() <= now) continue;
    if (!isSport(row.class.sport) || !isLevel(row.class.level)) continue;
    result.push({
      date,
      startTime: row.class.startTime,
      whenLabel: whenLabel(startsAt, row.class.startTime, timeZone),
      courtName: row.class.court.name,
      sportLabel: SPORT_LABELS[row.class.sport],
      levelLabel: LEVEL_LABELS[row.class.level],
      priceCents: row.priceCents,
    });
  }
  result.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  return result;
}

// Cancelled by date + start time (the way the customer talks about it), not
// by id: tool results never survive into the next turn, so an id the model
// "remembers" from list_my_enrollments would be made up.
export async function cancelEnrollment(
  companyId: string,
  customerId: string | null,
  input: { date: string; startTime: string; courtName?: string },
): Promise<{ success: true } | { error: 'enrollment_not_found' | 'ambiguous_enrollment'; message: string }> {
  const notFound = {
    error: 'enrollment_not_found' as const,
    message: 'Não encontrei essa inscrição para cancelar. Chame list_my_enrollments para ver as vagas reais.',
  };
  const startTime = normalizeStartTime(input.startTime);
  if (!customerId || !startTime || !parseIsoDate(input.date)) return notFound;

  const rows = await prisma.classEnrollment.findMany({
    where: { companyId, customerId, status: 'confirmed', date: dateColumnValue(input.date), class: { startTime } },
    include: { class: { include: { court: { select: { name: true } } } } },
  });
  const wanted = input.courtName ? input.courtName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() : null;
  const matches = wanted
    ? rows.filter((r) => {
        const n = r.class.court.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        return n.includes(wanted) || wanted.includes(n);
      })
    : rows;
  if (matches.length === 0) return notFound;
  if (matches.length > 1) {
    return { error: 'ambiguous_enrollment', message: 'Há mais de uma vaga nesse horário — informe a quadra (courtName).' };
  }
  await prisma.classEnrollment.update({ where: { id: matches[0]!.id }, data: { status: 'cancelled' } });
  return { success: true };
}
