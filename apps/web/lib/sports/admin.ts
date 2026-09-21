import { prisma } from '@zappigo/db';
import { getDeploymentTimezone, toWallClock } from '../format-time';
import { getCourtFreeSlots } from './courts';
import { addMinutesToTime, dateColumnValue, isoOfDateColumn, timeToMinutes, weekdayOf } from './classes';
import { isLevel, isSport } from './constants';

// Dashboard-side reads/writes for the sports modality: the weekly class grid,
// and the per-day agenda (classes + reservations + free blocks per court).

export interface ClassInput {
  courtId: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  sport: string;
  level: string;
  capacity: number;
  priceCents: number;
  instructorName?: string | null;
}

export type ClassInputError = 'invalid_input' | 'court_not_found' | 'overlap';

export async function createSportClass(companyId: string, input: ClassInput): Promise<{ ok: true } | { error: ClassInputError }> {
  const valid =
    isSport(input.sport) &&
    isLevel(input.level) &&
    Number.isInteger(input.weekday) &&
    input.weekday >= 0 &&
    input.weekday <= 6 &&
    /^\d{2}:\d{2}$/.test(input.startTime) &&
    input.durationMinutes >= 15 &&
    input.durationMinutes <= 240 &&
    input.capacity >= 1 &&
    input.capacity <= 100 &&
    input.priceCents >= 0;
  if (!valid) return { error: 'invalid_input' };

  const court = await prisma.court.findFirst({ where: { id: input.courtId, companyId } });
  if (!court) return { error: 'court_not_found' };

  // Same court, same weekday, overlapping time range with another active class.
  const start = timeToMinutes(input.startTime);
  const end = start + input.durationMinutes;
  const others = await prisma.sportClass.findMany({
    where: { companyId, courtId: input.courtId, weekday: input.weekday, active: true },
    select: { startTime: true, durationMinutes: true },
  });
  if (others.some((o) => start < timeToMinutes(o.startTime) + o.durationMinutes && timeToMinutes(o.startTime) < end)) {
    return { error: 'overlap' };
  }

  await prisma.sportClass.create({
    data: {
      companyId,
      courtId: input.courtId,
      weekday: input.weekday,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      sport: input.sport,
      level: input.level,
      capacity: input.capacity,
      priceCents: input.priceCents,
      instructorName: input.instructorName?.trim() || null,
    },
  });
  return { ok: true };
}

// --- day agenda ---------------------------------------------------------------

export type AgendaItem =
  | {
      kind: 'class';
      classId: string;
      startTime: string;
      endTime: string;
      sport: string;
      level: string;
      capacity: number;
      instructorName: string | null;
      cancelled: boolean;
      enrollments: { id: string; customerName: string; customerPhone: string | null; status: string }[];
    }
  | {
      kind: 'reservation';
      reservationId: string;
      startTime: string;
      endTime: string;
      participants: number | null;
      customerName: string;
      customerPhone: string | null;
    }
  | { kind: 'free'; startTime: string; endTime: string };

export interface CourtAgenda {
  courtId: string;
  courtName: string;
  items: AgendaItem[];
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export async function getDayAgenda(companyId: string, dateIso: string): Promise<{ courts: CourtAgenda[]; closed: boolean }> {
  const timeZone = getDeploymentTimezone();
  const weekday = weekdayOf(dateIso);
  const day = dateColumnValue(dateIso);

  const [courts, classes, overrides, enrollments, reservations, free] = await Promise.all([
    prisma.court.findMany({ where: { companyId, active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.sportClass.findMany({ where: { companyId, active: true, weekday }, orderBy: { startTime: 'asc' } }),
    prisma.classSessionOverride.findMany({ where: { class: { companyId }, date: day } }),
    prisma.classEnrollment.findMany({
      where: { companyId, date: day, status: { in: ['confirmed', 'attended', 'no_show'] } },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.courtReservation.findMany({
      where: {
        companyId,
        status: 'confirmed',
        startsAt: { gte: new Date(day.getTime() - 24 * 3600_000), lte: new Date(day.getTime() + 48 * 3600_000) },
      },
      include: { customer: { select: { name: true, phone: true } } },
    }),
    // 30-minute steps: contiguous runs are merged into "free" blocks below.
    getCourtFreeSlots(companyId, dateIso, { durationMinutes: 30 }),
  ]);

  const cancelledClasses = new Set(overrides.map((o) => o.classId));
  const freeByCourt = new Map<string, string[]>();
  if (!('error' in free)) for (const c of free.courts) freeByCourt.set(c.courtId, c.slots);

  const result: CourtAgenda[] = courts.map((court) => {
    const items: AgendaItem[] = [];

    for (const cls of classes.filter((c) => c.courtId === court.id)) {
      items.push({
        kind: 'class',
        classId: cls.id,
        startTime: cls.startTime,
        endTime: addMinutesToTime(cls.startTime, cls.durationMinutes),
        sport: cls.sport,
        level: cls.level,
        capacity: cls.capacity,
        instructorName: cls.instructorName,
        cancelled: cancelledClasses.has(cls.id),
        enrollments: enrollments
          .filter((e) => e.classId === cls.id && isoOfDateColumn(e.date) === dateIso)
          .map((e) => ({ id: e.id, customerName: e.customer.name ?? '—', customerPhone: e.customer.phone, status: e.status })),
      });
    }

    for (const r of reservations.filter((x) => x.courtId === court.id)) {
      const wall = toWallClock(timeZone, r.startsAt);
      const iso = `${wall.year}-${String(wall.month0 + 1).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`;
      if (iso !== dateIso) continue;
      const startMin = wall.hour * 60 + wall.minute;
      items.push({
        kind: 'reservation',
        reservationId: r.id,
        startTime: hhmm(startMin),
        endTime: hhmm(startMin + r.durationMinutes),
        participants: r.participants,
        customerName: r.customer?.name ?? '—',
        customerPhone: r.customer?.phone ?? null,
      });
    }

    // Merge free 30-minute starts into contiguous blocks.
    const starts = (freeByCourt.get(court.id) ?? []).map(timeToMinutes).sort((a, b) => a - b);
    let blockStart: number | null = null;
    let prev = 0;
    const flush = () => {
      if (blockStart !== null) items.push({ kind: 'free', startTime: hhmm(blockStart), endTime: hhmm(prev + 30) });
    };
    for (const m of starts) {
      if (blockStart !== null && m === prev + 30) {
        prev = m;
        continue;
      }
      flush();
      blockStart = m;
      prev = m;
    }
    flush();

    items.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    return { courtId: court.id, courtName: court.name, items };
  });

  return { courts: result, closed: !('error' in free) && !!free.closed };
}
