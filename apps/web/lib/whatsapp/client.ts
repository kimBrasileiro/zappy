import crypto from 'node:crypto';

const GRAPH_API_VERSION = 'v20.0';

// Best-effort, same spirit as the customer.update call in createBooking
// (services.ts): a missing/misconfigured shared number should never crash
// the caller (the webhook still has to record the conversation and ack the
// Meta request either way) — it just means the reply never actually reaches
// WhatsApp, which is loudly logged instead of thrown.
export async function sendWhatsAppMessage(toWaPhoneNumber: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn(`[whatsapp] credenciais ausentes — não enviado para ${toWaPhoneNumber}: "${text.slice(0, 80)}"`);
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toWaPhoneNumber,
        type: 'text',
        text: { body: text },
      }),
    });
    if (!response.ok) {
      console.error(`[whatsapp] send failed (${response.status}) for ${toWaPhoneNumber}: ${await response.text()}`);
    }
  } catch (err) {
    console.error(`[whatsapp] send threw for ${toWaPhoneNumber}`, err);
  }
}

// Meta signs the raw request body with the app secret (HMAC-SHA256) and
// sends it as `X-Hub-Signature-256: sha256=<hex>`. Must run against the raw
// bytes, before any JSON.parse — see app/api/webhooks/whatsapp/route.ts,
// which reads request.text() rather than request.json() for exactly this
// reason.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = signatureHeader.slice('sha256='.length);

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export interface InboundWhatsAppMessage {
  fromWaPhoneNumber: string; // raw, as Meta sends it (digits, country code, no "+") — also the "to" address for replies
  text: string;
  wamid: string;
}

// Meta's webhook payload shape: entry[].changes[].value.messages[]. Only
// text messages are handled — media/location/etc. come back as `null` and
// are silently ignored by the caller (no tool in this system's catalog can
// do anything useful with them yet).
export function parseInboundMessage(payload: unknown): InboundWhatsAppMessage | null {
  const entry = (payload as { entry?: unknown[] })?.entry?.[0] as
    | { changes?: { value?: { messages?: unknown[] } }[] }
    | undefined;
  const value = entry?.changes?.[0]?.value;
  const message = value?.messages?.[0] as
    | { from?: string; id?: string; type?: string; text?: { body?: string } }
    | undefined;

  if (!message || message.type !== 'text' || !message.from || !message.id || !message.text?.body) {
    return null;
  }

  return { fromWaPhoneNumber: message.from, text: message.text.body, wamid: message.id };
}

// services.ts#normalizePhone already normalizes customer-provided phone
// numbers to 10-11 local digits (no country code) for the booking flow.
// WhatsApp's inbound "from" always includes the 55 country code (e.g.
// "5511987654321") — stripped here so the SAME person is recognized as one
// Customer record whether they arrive via the web widget or WhatsApp.
export function toLocalPhone(waFrom: string): string {
  const digits = waFrom.replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}

// Inverse of toLocalPhone — services.ts#createBooking only ever has the
// 10-11 digit local format the customer typed into the web widget (never a
// country code, even when the booking itself came in over WhatsApp), but
// sending a message via the Cloud API needs the full number Meta expects.
// Brazil-only, matching normalizePhone's existing assumption.
export function toWhatsAppPhone(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}
