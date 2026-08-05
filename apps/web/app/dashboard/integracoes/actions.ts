'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { Prisma, prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { encrypt } from '../../../lib/crypto';

export async function disconnectGoogleCalendar(): Promise<void> {
  const { companyId } = await requireSession();
  await prisma.company.update({
    where: { id: companyId },
    data: {
      googleCalendarId: null,
      googleCalendarRefreshTokenEncrypted: null,
      googleCalendarConnectedEmail: null,
      googleCalendarConnectedAt: null,
    },
  });
  revalidatePath('/dashboard/integracoes');
}

export interface ConnectWhatsAppState {
  error?: string;
}

const GRAPH_API_VERSION = 'v20.0';

// Manual onboarding (see company.prisma's whatsappPhoneId comment): the
// business owner generates a permanent System User access token in their
// own Meta Business Manager (with whatsapp_business_messaging permission
// on their WABA) and pastes it here along with the phone_number_id — no
// Embedded Signup / App Review dependency, at the cost of a manual step on
// their side. Two real API calls happen before anything is saved:
//   1. A read against the phone number itself, which doubles as credential
//      validation — a bad/expired token fails here, not on the first real
//      send, and we get the real display number back for free.
//   2. Subscribing this phone number to Zappigo's own Meta App so inbound
//      messages actually start arriving at our webhook — sending and
//      receiving are separate permissions; saving a working send token
//      alone would silently never receive anything.
export async function connectWhatsAppNumber(_prevState: ConnectWhatsAppState, formData: FormData): Promise<ConnectWhatsAppState> {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.integrations');

  const phoneNumberId = String(formData.get('phoneNumberId') ?? '').trim();
  const accessToken = String(formData.get('accessToken') ?? '').trim();
  if (!phoneNumberId || !accessToken) {
    return { error: t('whatsappErrorFillFields') };
  }

  // Two distinct integrity checks, both required — a proactive check here
  // gives a clear, translated error instead of a raw constraint-violation
  // 500, but only the DB's own @unique on whatsappPhoneId (see
  // company.prisma) actually closes the race between this check and the
  // write below; the catch around the final update is the real backstop.
  const current = await prisma.company.findUnique({ where: { id: companyId }, select: { whatsappPhoneId: true } });
  if (current?.whatsappPhoneId && current.whatsappPhoneId !== phoneNumberId) {
    return { error: t('whatsappErrorAlreadyConnected') };
  }
  const takenByOther = await prisma.company.findFirst({
    where: { whatsappPhoneId: phoneNumberId, id: { not: companyId } },
    select: { id: true },
  });
  if (takenByOther) {
    return { error: t('whatsappErrorNumberTaken') };
  }

  let displayNumber: string | null = null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return { error: t('whatsappErrorInvalidCredentials') };
    const info = (await res.json()) as { display_phone_number?: string; verified_name?: string };
    displayNumber = info.display_phone_number ?? info.verified_name ?? null;
  } catch (err) {
    console.error('[integracoes] whatsapp credential validation threw', err);
    return { error: t('whatsappErrorInvalidCredentials') };
  }

  try {
    const subscribeRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!subscribeRes.ok) return { error: t('whatsappErrorSubscribeFailed') };
  } catch (err) {
    console.error('[integracoes] whatsapp webhook subscription threw', err);
    return { error: t('whatsappErrorSubscribeFailed') };
  }

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        whatsappPhoneId: phoneNumberId,
        whatsappTokenEncrypted: encrypt(accessToken, 'WHATSAPP_TOKEN_ENCRYPTION_KEY'),
        whatsappConnectedNumber: displayNumber ?? phoneNumberId,
        whatsappConnectedAt: new Date(),
      },
    });
  } catch (err) {
    // P2002: another company won the race and took this phone_number_id
    // between the check above and this write — extremely unlikely (two
    // simultaneous connect attempts for the same number), but the pre-check
    // alone can't guarantee it, only the DB's own @unique index can.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: t('whatsappErrorNumberTaken') };
    }
    throw err;
  }

  revalidatePath('/dashboard/integracoes');
  return {};
}

// No WhatsAppRoute cleanup needed — a dedicated number is never written
// there in the first place (see lib/bot/conversation.ts#resolveWhatsAppRoute),
// so disconnecting is just clearing these four columns.
export async function disconnectWhatsAppNumber(): Promise<void> {
  const { companyId } = await requireSession();
  await prisma.company.update({
    where: { id: companyId },
    data: {
      whatsappPhoneId: null,
      whatsappTokenEncrypted: null,
      whatsappConnectedNumber: null,
      whatsappConnectedAt: null,
    },
  });
  revalidatePath('/dashboard/integracoes');
}
