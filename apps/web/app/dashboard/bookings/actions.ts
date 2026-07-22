'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';

export async function cancelBooking(bookingId: string): Promise<void> {
  const { companyId } = await requireSession();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.companyId !== companyId) return;

  await prisma.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } });
  revalidatePath('/dashboard/bookings');
}

async function setAttendance(bookingId: string, status: 'completed' | 'no_show'): Promise<void> {
  const { companyId } = await requireSession();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.companyId !== companyId) return;

  await prisma.booking.update({ where: { id: bookingId }, data: { status } });
  revalidatePath('/dashboard/bookings');
}

export async function markBookingAttended(bookingId: string): Promise<void> {
  await setAttendance(bookingId, 'completed');
}

export async function markBookingNoShow(bookingId: string): Promise<void> {
  await setAttendance(bookingId, 'no_show');
}
