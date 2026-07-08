'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@chat-ia/db';
import { requireSession } from '../../../lib/auth-server';

export async function cancelBooking(bookingId: string): Promise<void> {
  const { companyId } = await requireSession();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.companyId !== companyId) return;

  await prisma.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } });
  revalidatePath('/dashboard/bookings');
}
