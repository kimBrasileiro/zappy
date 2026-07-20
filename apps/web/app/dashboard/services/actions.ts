'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma, Prisma } from '@zappy/db';
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

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const durationMinutes = parseDurationMinutes(formData);
  const priceCents = parsePriceCents(formData);
  const bookingMode = String(formData.get('bookingMode') ?? 'auto') === 'manual' ? 'manual' : 'auto';
  const is24h = formData.get('is24h') === 'on';
  const businessHours = parseBusinessHours(formData);

  if (!name) return { error: 'Nome é obrigatório.' };
  if (durationMinutes === null) return { error: 'Duração inválida.' };
  if (priceCents === null) return { error: 'Preço inválido.' };

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

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.companyId !== companyId) return { error: 'Serviço não encontrado.' };

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const durationMinutes = parseDurationMinutes(formData);
  const priceCents = parsePriceCents(formData);
  const bookingMode = String(formData.get('bookingMode') ?? 'auto') === 'manual' ? 'manual' : 'auto';
  const is24h = formData.get('is24h') === 'on';
  const businessHours = parseBusinessHours(formData);

  if (!name) return { error: 'Nome é obrigatório.' };
  if (durationMinutes === null) return { error: 'Duração inválida.' };
  if (priceCents === null) return { error: 'Preço inválido.' };

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
