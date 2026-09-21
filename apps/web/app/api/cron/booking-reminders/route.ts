import { NextResponse } from 'next/server';
import { prisma } from '@zappigo/db';
import { formatDate, formatTime, getDeploymentTimezone } from '../../../../lib/format-time';
import { resolveWhatsAppCredentials, sendWhatsAppTemplate, toWhatsAppPhone } from '../../../../lib/whatsapp/client';

const HOUR_MS = 60 * 60_000;

// Two passes, each with a window generous enough to tolerate the cron
// firing every 15min without ever missing a booking (see infra's
// cloud_scheduler.tf) — reminderDaySentAt/reminderHourSentAt (not a
// boolean) is what actually prevents a double-send if this route somehow
// runs twice for the same booking inside one window.
const DAY_WINDOW_MIN_HOURS = 23;
const DAY_WINDOW_MAX_HOURS = 25;
const HOUR_WINDOW_MIN_MINUTES = 45;
const HOUR_WINDOW_MAX_MINUTES = 75;

type ReminderKind = 'day' | 'hour';

// sendWhatsAppTemplate (via sendWhatsAppPayload) is fire-and-forget by
// design — it logs its own failures and never throws or returns a result,
// same as every other WhatsApp send in this codebase (see that function's
// own comment). So "attempted" here means "had a real name+phone to send
// to," not "Meta actually delivered it" — there's no signal for the
// latter to act on. A row with no customer contact info keeps matching
// this query on every tick until it ages out of the window, which is
// harmless (a few extra no-op queries), not a retry loop worth guarding.
async function sendReminder(
  booking: {
    scheduledAt: Date;
    service: { name: string };
    customer: { name: string | null; phone: string | null } | null;
    company: { whatsappPhoneId: string | null; whatsappTokenEncrypted: string | null };
  },
  kind: ReminderKind,
): Promise<boolean> {
  if (!booking.customer?.name || !booking.customer.phone) return false;

  const tz = getDeploymentTimezone();
  await sendWhatsAppTemplate(
    toWhatsAppPhone(booking.customer.phone),
    'booking_reminder',
    'pt_BR',
    [
      booking.customer.name,
      booking.service.name,
      kind === 'day' ? 'amanhã' : 'em breve',
      formatDate(booking.scheduledAt, 'pt-BR', tz),
      formatTime(booking.scheduledAt, 'pt-BR', tz),
    ],
    resolveWhatsAppCredentials(booking.company),
  );
  return true;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const include = { service: true, customer: true, company: true } as const;

  const [dayBookings, hourBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: 'confirmed',
        reminderDaySentAt: null,
        scheduledAt: { gte: new Date(now + DAY_WINDOW_MIN_HOURS * HOUR_MS), lte: new Date(now + DAY_WINDOW_MAX_HOURS * HOUR_MS) },
      },
      include,
    }),
    prisma.booking.findMany({
      where: {
        status: 'confirmed',
        reminderHourSentAt: null,
        scheduledAt: {
          gte: new Date(now + HOUR_WINDOW_MIN_MINUTES * 60_000),
          lte: new Date(now + HOUR_WINDOW_MAX_MINUTES * 60_000),
        },
      },
      include,
    }),
  ]);

  let daySent = 0;
  for (const booking of dayBookings) {
    const attempted = await sendReminder(booking, 'day');
    if (attempted) {
      await prisma.booking.update({ where: { id: booking.id }, data: { reminderDaySentAt: new Date() } });
      daySent++;
    }
  }

  let hourSent = 0;
  for (const booking of hourBookings) {
    const attempted = await sendReminder(booking, 'hour');
    if (attempted) {
      await prisma.booking.update({ where: { id: booking.id }, data: { reminderHourSentAt: new Date() } });
      hourSent++;
    }
  }

  return NextResponse.json({
    dayChecked: dayBookings.length,
    daySent,
    hourChecked: hourBookings.length,
    hourSent,
  });
}
