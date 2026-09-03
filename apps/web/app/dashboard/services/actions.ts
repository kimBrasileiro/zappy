'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma, Prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import type { BusinessHours } from './service-form';

export interface ServiceFormState {
  error?: string;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseDurationMinutes(formData: FormData): number | null {
  const value = Number(formData.get('durationValue'));
  const unit = String(formData.get('durationUnit') ?? 'minutes');
  if (!value || value <= 0) return null;
  return Math.round(unit === 'hours' ? value * 60 : value);
}

function parsePriceCents(formData: FormData): number | null {
  const value = Number(String(formData.get('price') ?? '').replace(',', '.'));
  if (Number.isNaN(value) || value < 0) return null;
  return Math.round(value * 100);
}

const CANCELLATION_NOTICE_OPTIONS = [0, 2, 12, 24, 48];

function parseCancellationNoticeHours(formData: FormData): number {
  const value = Number(formData.get('cancellationNoticeHours'));
  // Falls back to 0 (no restriction) for anything outside the fixed set the
  // <select> actually offers — never trust a raw client-submitted number
  // here, this isn't meant to be freely arbitrary.
  return CANCELLATION_NOTICE_OPTIONS.includes(value) ? value : 0;
}

function parseCancellationFeeCents(formData: FormData): number {
  const raw = String(formData.get('cancellationFee') ?? '').trim();
  if (!raw) return 0;
  const value = Number(raw.replace(',', '.'));
  if (Number.isNaN(value) || value < 0) return 0;
  return Math.round(value * 100);
}

// Staff is mandatory (service-form.tsx always renders at least one
// staffName_0/staffDuration_0 row — see StaffRow) — reads the indexed rows
// the client component serializes rather than a single comma-separated
// field, since each row also carries its own optional duration override.
function parseStaffRows(formData: FormData): { staffNames: string[]; staffDurations: Record<string, number> } {
  const seen = new Set<string>();
  const staffNames: string[] = [];
  const staffDurations: Record<string, number> = {};

  for (let idx = 0; formData.has(`staffName_${idx}`); idx++) {
    const name = String(formData.get(`staffName_${idx}`) ?? '').trim();
    if (!name) continue;
    // De-duplicated case/accent-insensitively but keeps the first spelling
    // typed — two rows that only differ by casing/accents would otherwise
    // silently create two "different" staff members that conflict-checking
    // treats as distinct people.
    const key = name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    staffNames.push(name);

    const durationRaw = Number(formData.get(`staffDuration_${idx}`));
    if (durationRaw > 0) staffDurations[name] = Math.round(durationRaw);
  }

  return { staffNames, staffDurations };
}

function parseBusinessHours(formData: FormData): BusinessHours | null {
  // Mutually exclusive with is24h — the 24h checkbox hides this section in
  // the form entirely, and businessHours is meaningless once every day/time
  // is open anyway.
  if (formData.get('is24h') === 'on') return null;
  if (formData.get('useCustomHours') !== 'on') return null;

  const hours: BusinessHours = {};
  for (const day of DAY_KEYS) {
    const closed = formData.get(`hours_${day}_closed`) === 'on';
    if (closed) {
      hours[day] = null;
      continue;
    }
    const open = String(formData.get(`hours_${day}_open`) ?? '').trim();
    const close = String(formData.get(`hours_${day}_close`) ?? '').trim();
    hours[day] = open && close ? [open, close] : null;
  }
  return hours;
}

export async function createService(
  _prevState: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const { companyId, userId } = await requireSession();
  const t = await getTranslations('dashboard.services');

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const durationMinutes = parseDurationMinutes(formData);
  const priceCents = parsePriceCents(formData);
  const bookingMode = String(formData.get('bookingMode') ?? 'auto') === 'manual' ? 'manual' : 'auto';
  const is24h = formData.get('is24h') === 'on';
  const businessHours = parseBusinessHours(formData);
  const cancellationNoticeHours = parseCancellationNoticeHours(formData);
  const cancellationFeeCents = parseCancellationFeeCents(formData);
  const { staffNames, staffDurations } = parseStaffRows(formData);

  if (!name) return { error: t('errorNameRequired') };
  if (durationMinutes === null) return { error: t('errorInvalidDuration') };
  if (priceCents === null) return { error: t('errorInvalidPrice') };
  if (staffNames.length === 0) return { error: t('errorStaffRequired') };

  await prisma.service.create({
    data: {
      companyId,
      name,
      description,
      durationMinutes,
      priceCents,
      bookingMode,
      is24h,
      businessHours: businessHours ?? undefined,
      cancellationNoticeHours,
      cancellationFeeCents,
      staffNames,
      staffDurations,
      createdBy: userId,
    },
  });

  revalidatePath('/dashboard/services');
  redirect('/dashboard/services');
}

export async function updateService(
  serviceId: string,
  _prevState: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.services');

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.companyId !== companyId) return { error: t('errorServiceNotFound') };

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const durationMinutes = parseDurationMinutes(formData);
  const priceCents = parsePriceCents(formData);
  const bookingMode = String(formData.get('bookingMode') ?? 'auto') === 'manual' ? 'manual' : 'auto';
  const is24h = formData.get('is24h') === 'on';
  const businessHours = parseBusinessHours(formData);
  const cancellationNoticeHours = parseCancellationNoticeHours(formData);
  const cancellationFeeCents = parseCancellationFeeCents(formData);
  const { staffNames, staffDurations } = parseStaffRows(formData);

  if (!name) return { error: t('errorNameRequired') };
  if (durationMinutes === null) return { error: t('errorInvalidDuration') };
  if (priceCents === null) return { error: t('errorInvalidPrice') };
  if (staffNames.length === 0) return { error: t('errorStaffRequired') };

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      name,
      description,
      durationMinutes,
      priceCents,
      bookingMode,
      is24h,
      businessHours: businessHours ?? Prisma.JsonNull,
      cancellationNoticeHours,
      cancellationFeeCents,
      staffNames,
      staffDurations,
    },
  });

  revalidatePath('/dashboard/services');
  redirect('/dashboard/services');
}

export async function toggleServiceActive(serviceId: string): Promise<void> {
  const { companyId } = await requireSession();
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.companyId !== companyId) return;

  await prisma.service.update({ where: { id: serviceId }, data: { active: !service.active } });
  revalidatePath('/dashboard/services');
}

export async function deleteService(serviceId: string): Promise<void> {
  const { companyId } = await requireSession();
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.companyId !== companyId) return;

  try {
    await prisma.service.delete({ where: { id: serviceId } });
  } catch {
    // Has existing bookings referencing it (FK restrict) — retire it via
    // "Desativar" instead of a hard delete that would break booking history.
  }
  revalidatePath('/dashboard/services');
}

export interface StaffAbsenceFormState {
  error?: string;
}

// Deliberately just add/remove by date — no recurring rules, no time-of-day
// granularity. See lib/bot/services.ts, which excludes any staff member with
// a row here (for that service+date) from both check_availability and
// create_booking's auto-allocation.
export async function addStaffAbsence(
  serviceId: string,
  _prevState: StaffAbsenceFormState,
  formData: FormData,
): Promise<StaffAbsenceFormState> {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.services');
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.companyId !== companyId) return { error: t('errorServiceNotFound') };

  const staffName = String(formData.get('staffName') ?? '').trim();
  const dateRaw = String(formData.get('date') ?? '').trim();
  if (!staffName || !service.staffNames.includes(staffName)) {
    return { error: t('errorChooseStaff') };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateRaw);
  if (!match) return { error: t('errorChooseDate') };
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  try {
    await prisma.staffAbsence.create({ data: { companyId, serviceId, staffName, date } });
  } catch (err) {
    // (service_id, staff_name, date) unique — already marked, nothing to do.
    if ((err as { code?: string }).code !== 'P2002') throw err;
  }

  revalidatePath(`/dashboard/services/${serviceId}`);
  return {};
}

export async function removeStaffAbsence(serviceId: string, absenceId: string): Promise<void> {
  const { companyId } = await requireSession();
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.companyId !== companyId) return;

  await prisma.staffAbsence.deleteMany({ where: { id: absenceId, serviceId } });
  revalidatePath(`/dashboard/services/${serviceId}`);
}
