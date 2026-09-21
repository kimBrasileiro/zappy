'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { notifyBookingCancelled } from '../../../lib/notifications';
import { resolveWhatsAppCredentials } from '../../../lib/whatsapp/client';

// Staff-initiated cancel (this button, on the dashboard) previously never
// told the customer at all — only the bot's own cancelBooking
// (lib/bot/services.ts) did. A customer cancelled from here otherwise has
// no way to know except finding out the hard way at the door.
export async function cancelBooking(bookingId: string): Promise<void> {
  const { companyId } = await requireSession();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, customer: true },
  });
  if (!booking || booking.companyId !== companyId) return;

  await prisma.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { whatsappPhoneId: true, whatsappTokenEncrypted: true },
  });
  await notifyBookingCancelled({
    companyId,
    serviceName: booking.service.name,
    scheduledAt: booking.scheduledAt,
    customerName: booking.customer?.name ?? undefined,
    customerPhone: booking.customer?.phone ?? undefined,
    whatsappCredentials: resolveWhatsAppCredentials(company ?? { whatsappPhoneId: null, whatsappTokenEncrypted: null }),
  });

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
