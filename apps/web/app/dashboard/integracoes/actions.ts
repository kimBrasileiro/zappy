'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
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

  await prisma.company.update({
    where: { id: companyId },
    data: {
      whatsappPhoneId: phoneNumberId,
      whatsappTokenEncrypted: encrypt(accessToken, 'WHATSAPP_TOKEN_ENCRYPTION_KEY'),
      whatsappConnectedNumber: displayNumber ?? phoneNumberId,
      whatsappConnectedAt: new Date(),
    },
  });

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
