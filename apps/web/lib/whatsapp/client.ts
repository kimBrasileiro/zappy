import crypto from 'node:crypto';

const GRAPH_API_VERSION = 'v20.0';

// Best-effort, same spirit as the customer.update call in createBooking
// (services.ts): a missing/misconfigured shared number should never crash
// the caller (the webhook still has to record the conversation and ack the
// Meta request either way) — it just means the reply never actually reaches
// WhatsApp, which is loudly logged instead of thrown.
async function sendWhatsAppPayload(toWaPhoneNumber: string, body: Record<string, unknown>, logExcerpt: string): Promise<void> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn(`[whatsapp] credenciais ausentes — não enviado para ${toWaPhoneNumber}: "${logExcerpt.slice(0, 80)}"`);
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: toWaPhoneNumber, ...body }),
    });
    if (!response.ok) {
      console.error(`[whatsapp] send failed (${response.status}) for ${toWaPhoneNumber}: ${await response.text()}`);
    }
  } catch (err) {
    console.error(`[whatsapp] send threw for ${toWaPhoneNumber}`, err);
  }
}

export async function sendWhatsAppMessage(toWaPhoneNumber: string, text: string): Promise<void> {
  await sendWhatsAppPayload(toWaPhoneNumber, { type: 'text', text: { body: text } }, text);
}

// WhatsApp reply buttons: max 3, each title capped at 20 chars. List
// messages: max 10 rows, each title capped at 24 chars. Both surface the
// same orchestrator-computed quickReplies the web widget already renders as
// chips (see apps/web/app/api/chat/route.ts's "options" frame) — the row/
// button `id` carries the full, untruncated text (well under Meta's 200/256
// char id limits for these short prompts) so a tap round-trips through
// parseInboundMessage as if the customer had typed that exact quick reply.
const BUTTON_TITLE_MAX = 20;
const LIST_ROW_TITLE_MAX = 24;
const MAX_LIST_ROWS = 10;

function truncateTitle(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function sendWhatsAppQuickReplies(
  toWaPhoneNumber: string,
  bodyText: string,
  options: string[],
): Promise<void> {
  if (options.length === 0) {
    await sendWhatsAppMessage(toWaPhoneNumber, bodyText);
    return;
  }

  if (options.length <= 3) {
    await sendWhatsAppPayload(
      toWaPhoneNumber,
      {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: options.map((option) => ({
              type: 'reply',
              reply: { id: option, title: truncateTitle(option, BUTTON_TITLE_MAX) },
            })),
          },
        },
      },
      bodyText,
    );
    return;
  }

  await sendWhatsAppPayload(
    toWaPhoneNumber,
    {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: 'Escolher',
          sections: [
            {
              rows: options.slice(0, MAX_LIST_ROWS).map((option) => ({
                id: option,
                title: truncateTitle(option, LIST_ROW_TITLE_MAX),
              })),
            },
          ],
        },
      },
    },
    bodyText,
  );
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

// Meta's webhook payload shape: entry[].changes[].value.messages[]. Handles
// plain text and taps on our own interactive messages (button_reply/list_reply)
// — both come back as `null` for anything else (media/location/etc.), since no
// tool in this system's catalog can do anything useful with those yet.
export function parseInboundMessage(payload: unknown): InboundWhatsAppMessage | null {
  const entry = (payload as { entry?: unknown[] })?.entry?.[0] as
    | { changes?: { value?: { messages?: unknown[] } }[] }
    | undefined;
  const value = entry?.changes?.[0]?.value;
  const message = value?.messages?.[0] as
    | {
        from?: string;
        id?: string;
        type?: string;
        text?: { body?: string };
        interactive?: {
          type?: string;
          button_reply?: { id?: string };
          list_reply?: { id?: string };
        };
      }
    | undefined;

  if (!message?.from || !message.id) return null;

  if (message.type === 'text' && message.text?.body) {
    return { fromWaPhoneNumber: message.from, text: message.text.body, wamid: message.id };
  }

  // A button/list tap's `id` is the full original quick-reply text we sent it
  // as (see sendWhatsAppQuickReplies) — feeding it back through as if the
  // customer typed it themselves keeps the orchestrator's contract (it only
  // ever deals in free text) unchanged.
  if (message.type === 'interactive') {
    const tappedId = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id;
    if (tappedId) return { fromWaPhoneNumber: message.from, text: tappedId, wamid: message.id };
  }

  return null;
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
