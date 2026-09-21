'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../lib/auth-server';
import { createSportClass } from '../../lib/sports/admin';
import { dateColumnValue, parseIsoDate } from '../../lib/sports/classes';
import { isLevel, isSport } from '../../lib/sports/constants';

// Every action re-derives companyId from the session and scopes the row
// lookups by it — ids come from the browser and are never trusted alone.

export interface SportsFormState {
  error?: string;
  ok?: boolean;
}

function priceToCents(raw: FormDataEntryValue | null): number {
  const value = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : -1;
}

// --- courts -------------------------------------------------------------------

export async function createCourt(_prev: SportsFormState, formData: FormData): Promise<SportsFormState> {
  const { companyId } = await requireSession();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'nameRequired' };

  const existing = await prisma.court.findMany({ where: { companyId }, select: { name: true, sortOrder: true } });
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) return { error: 'nameTaken' };

  await prisma.court.create({
    data: { companyId, name, sortOrder: existing.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1 },
  });
  revalidatePath('/dashboard/quadras');
  return { ok: true };
}

export async function toggleCourtActive(courtId: string): Promise<void> {
  const { companyId } = await requireSession();
  const court = await prisma.court.findFirst({ where: { id: courtId, companyId } });
  if (!court) return;
  await prisma.court.update({ where: { id: courtId }, data: { active: !court.active } });
  revalidatePath('/dashboard/quadras');
  revalidatePath('/dashboard/agenda-quadras');
}

// --- weekly class grid --------------------------------------------------------

export async function createClass(_prev: SportsFormState, formData: FormData): Promise<SportsFormState> {
  const { companyId } = await requireSession();
  const priceCents = priceToCents(formData.get('price'));
  if (priceCents < 0) return { error: 'invalid' };

  const result = await createSportClass(companyId, {
    courtId: String(formData.get('courtId') ?? ''),
    weekday: Number(formData.get('weekday')),
    startTime: String(formData.get('startTime') ?? ''),
    durationMinutes: Number(formData.get('durationMinutes') ?? 60),
    sport: String(formData.get('sport') ?? ''),
    level: String(formData.get('level') ?? ''),
    capacity: Number(formData.get('capacity')),
    priceCents,
    instructorName: String(formData.get('instructorName') ?? ''),
  });
  if ('error' in result) return { error: result.error === 'overlap' ? 'overlap' : 'invalid' };

  revalidatePath('/dashboard/turmas');
  revalidatePath('/dashboard/agenda-quadras');
  return { ok: true };
}

export async function toggleClassActive(classId: string): Promise<void> {
  const { companyId } = await requireSession();
  const cls = await prisma.sportClass.findFirst({ where: { id: classId, companyId } });
  if (!cls) return;
  await prisma.sportClass.update({ where: { id: classId }, data: { active: !cls.active } });
  revalidatePath('/dashboard/turmas');
  revalidatePath('/dashboard/agenda-quadras');
}

// Only a class that never had anyone enrolled can be removed — anything with
// history is just deactivated, so past enrollments/reports keep their class.
export async function deleteClass(classId: string): Promise<void> {
  const { companyId } = await requireSession();
  const cls = await prisma.sportClass.findFirst({ where: { id: classId, companyId } });
  if (!cls) return;
  const used = await prisma.classEnrollment.count({ where: { classId } });
  if (used > 0) await prisma.sportClass.update({ where: { id: classId }, data: { active: false } });
  else await prisma.sportClass.delete({ where: { id: classId } });
  revalidatePath('/dashboard/turmas');
  revalidatePath('/dashboard/agenda-quadras');
}

// --- one day of the agenda -----------------------------------------------------

// Cancels a single dated session (rain, holiday): override + every confirmed
// enrollment for that day marked cancelled, in one transaction.
export async function cancelClassSession(classId: string, date: string): Promise<void> {
  const { companyId } = await requireSession();
  if (!parseIsoDate(date)) return;
  const cls = await prisma.sportClass.findFirst({ where: { id: classId, companyId } });
  if (!cls) return;
  const day = dateColumnValue(date);
  await prisma.$transaction([
    prisma.classSessionOverride.upsert({
      where: { classId_date: { classId, date: day } },
      create: { classId, date: day, status: 'cancelled' },
      update: {},
    }),
    prisma.classEnrollment.updateMany({
      where: { classId, date: day, status: 'confirmed' },
      data: { status: 'cancelled' },
    }),
  ]);
  revalidatePath('/dashboard/agenda-quadras');
}

export async function restoreClassSession(classId: string, date: string): Promise<void> {
  const { companyId } = await requireSession();
  if (!parseIsoDate(date)) return;
  const cls = await prisma.sportClass.findFirst({ where: { id: classId, companyId } });
  if (!cls) return;
  await prisma.classSessionOverride.deleteMany({ where: { classId, date: dateColumnValue(date) } });
  revalidatePath('/dashboard/agenda-quadras');
}

export async function markEnrollment(enrollmentId: string, status: 'attended' | 'no_show' | 'cancelled' | 'confirmed'): Promise<void> {
  const { companyId } = await requireSession();
  const enrollment = await prisma.classEnrollment.findFirst({ where: { id: enrollmentId, companyId } });
  if (!enrollment) return;
  await prisma.classEnrollment.update({ where: { id: enrollmentId }, data: { status } });
  revalidatePath('/dashboard/agenda-quadras');
}

export async function cancelCourtReservation(reservationId: string): Promise<void> {
  const { companyId } = await requireSession();
  const reservation = await prisma.courtReservation.findFirst({ where: { id: reservationId, companyId } });
  if (!reservation) return;
  await prisma.courtReservation.update({ where: { id: reservationId }, data: { status: 'cancelled' } });
  revalidatePath('/dashboard/agenda-quadras');
}

// The agenda's "open a class here" one-click: a weekly class in that free
// block, with sensible defaults the owner can refine later in Turmas.
export async function openClassFromAgenda(formData: FormData): Promise<void> {
  const { companyId } = await requireSession();
  const date = String(formData.get('date') ?? '');
  const parsed = parseIsoDate(date);
  if (!parsed) return;
  const weekday = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay();
  const priceCents = priceToCents(formData.get('price'));
  await createSportClass(companyId, {
    courtId: String(formData.get('courtId') ?? ''),
    weekday,
    startTime: String(formData.get('startTime') ?? ''),
    durationMinutes: Number(formData.get('durationMinutes') ?? 60),
    sport: String(formData.get('sport') ?? ''),
    level: String(formData.get('level') ?? ''),
    capacity: Number(formData.get('capacity') ?? 8),
    priceCents: priceCents < 0 ? 0 : priceCents,
  });
  revalidatePath('/dashboard/agenda-quadras');
  revalidatePath('/dashboard/turmas');
}

// --- student levels (client profile) ---------------------------------------------

export async function saveClientSportLevel(customerId: string, sport: string, formData: FormData): Promise<void> {
  const { companyId } = await requireSession();
  const level = String(formData.get('level') ?? '');
  if (!isSport(sport) || (level && !isLevel(level))) return;
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } });
  if (!customer) return;
  if (!level) {
    await prisma.customerSportLevel.deleteMany({ where: { companyId, customerId, sport } });
  } else {
    await prisma.customerSportLevel.upsert({
      where: { customerId_sport: { customerId, sport } },
      create: { companyId, customerId, sport, level },
      update: { level },
    });
  }
  revalidatePath(`/dashboard/clients/${customerId}`);
}
