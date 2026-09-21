import crypto from 'node:crypto';
import { decrypt } from '../crypto';

const GRAPH_API_VERSION = 'v20.0';

// A company that connected its own dedicated number (see dashboard/
// integracoes and resolveWhatsAppCredentials below) always sends through
// THIS token/number — never the shared platform one, even as a fallback.
// Mixing the two would mean a customer who deliberately messaged a
// business's own private number could get a reply that looks like it came
// from Zappigo's shared number instead, or vice versa.
export interface WhatsAppCredentials {
  token: string;
  phoneNumberId: string;
}
const WHATSAPP_TOKEN_ENCRYPTION_KEY_ENV = 'WHATSAPP_TOKEN_ENCRYPTION_KEY';

// 'shared' = this company has no dedicated number, use the platform's own
// (the default, and the only state that existed before this feature).
// 'broken' = whatsappPhoneId is set but the token is missing or fails to
// decrypt — an inconsistent state that must NEVER silently fall back to
// the shared number (see the module comment above); callers must refuse
// to send and log loudly instead.
export type ResolvedWhatsAppCredentials = WhatsAppCredentials | 'shared' | 'broken';

export function resolveWhatsAppCredentials(
  company: { whatsappPhoneId: string | null; whatsappTokenEncrypted: string | null },
): ResolvedWhatsAppCredentials {
  if (!company.whatsappPhoneId) return 'shared';
  if (!company.whatsappTokenEncrypted) return 'broken';
  try {
    return { token: decrypt(company.whatsappTokenEncrypted, WHATSAPP_TOKEN_ENCRYPTION_KEY_ENV), phoneNumberId: company.whatsappPhoneId };
  } catch (err) {
    console.error(`[whatsapp] failed to decrypt dedicated-number token for phoneId ${company.whatsappPhoneId}`, err);
    return 'broken';
  }
}

// Meta's customer-service window: a business can only send free-form
// text/interactive WhatsApp messages within 24h of the customer's own last
// inbound message — outside that window only a pre-approved template
// message (not used anywhere in this codebase) is allowed, and Meta simply
// rejects a free-form send. sendWhatsAppMessage/sendWhatsAppPayload above
// don't check this themselves (best-effort, fire-and-forget) — callers on
// a path a human can trigger arbitrarily long after the customer's last
// message (see dashboard/conversations/[ticketId]/actions.ts#sendAgentReply)
// need to check it BEFORE sending, since a rejected send today fails
// silently (console.error only) with no signal back to the agent.
export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinWhatsAppSessionWindow(lastCustomerMessageAt: Date | null): boolean {
  if (!lastCustomerMessageAt) return false;
  return Date.now() - lastCustomerMessageAt.getTime() < WHATSAPP_SESSION_WINDOW_MS;
}

// Best-effort, same spirit as the customer.update call in createBooking
// (services.ts): a missing/misconfigured shared number should never crash
// the caller (the webhook still has to record the conversation and ack the
// Meta request either way) — it just means the reply never actually reaches
// WhatsApp, which is loudly logged instead of thrown.
//
// `credentials` omitted (or 'shared') uses the platform's own env-configured
// number, exactly as before this feature existed. 'broken' means the caller
// resolved a company that has a dedicated number configured but couldn't
// get working credentials for it — refuses to send at all rather than
// guessing which identity to use.
async function sendWhatsAppPayload(
  toWaPhoneNumber: string,
  body: Record<string, unknown>,
  logExcerpt: string,
  credentials: ResolvedWhatsAppCredentials = 'shared',
): Promise<void> {
  if (credentials === 'broken') {
    console.error(
      `[whatsapp] refusing to send to ${toWaPhoneNumber} — company has a dedicated number configured but credentials are broken (not falling back to the shared number)`,
    );
    return;
  }

  const token = credentials === 'shared' ? process.env.WHATSAPP_CLOUD_API_TOKEN : credentials.token;
  const phoneNumberId = credentials === 'shared' ? process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID : credentials.phoneNumberId;

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

export async function sendWhatsAppMessage(
  toWaPhoneNumber: string,
  text: string,
  credentials?: ResolvedWhatsAppCredentials,
): Promise<void> {
  await sendWhatsAppPayload(toWaPhoneNumber, { type: 'text', text: { body: text } }, text, credentials);
}

// A pre-approved Meta message template — the ONLY kind of message Meta
// accepts outside the 24h customer-service window above (see
// WHATSAPP_SESSION_WINDOW_MS's comment). Used for booking reminders (sent
// well outside that window by design) and cancellation notices (sent this
// way unconditionally, so it works whether the cancellation happened inside
// or outside the window, without this caller needing to check
// isWithinWhatsAppSessionWindow itself). Template name/params must exactly
// match what was submitted for approval — see scripts/submit-whatsapp-
// templates.ts for the actual body text of each one this app uses.
export async function sendWhatsAppTemplate(
  toWaPhoneNumber: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
  credentials?: ResolvedWhatsAppCredentials,
): Promise<void> {
  await sendWhatsAppPayload(
    toWaPhoneNumber,
    {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }],
      },
    },
    `[template:${templateName}]`,
    credentials,
  );
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
  credentials?: ResolvedWhatsAppCredentials,
): Promise<void> {
  if (options.length === 0) {
    await sendWhatsAppMessage(toWaPhoneNumber, bodyText, credentials);
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
      credentials,
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
    credentials,
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
  // Exactly one of text/audio is ever set. text stays required-ish in
  // practice (every existing call site reads it directly), audio is the new
  // case a caller has to check for and resolve to text itself (see
  // api/webhooks/whatsapp/route.ts) before anything downstream (routing,
  // orchestrate) can run — this module has no way to transcribe on its own.
  text?: string;
  audio?: { mediaId: string; mimeType: string };
  wamid: string;
  // The Meta phone_number_id that RECEIVED this message — set by Meta
  // itself in the verified webhook payload, never derivable from message
  // text/sender. This is the one signal a dedicated number's own routing
  // (lib/bot/conversation.ts#resolveWhatsAppRoute) can trust unconditionally:
  // it can't be spoofed by anything a customer types, only by forging
  // Meta's HMAC signature (checked before this function ever runs — see
  // verifyWebhookSignature above). Absent only if Meta's payload shape ever
  // omits metadata, which shouldn't happen in practice.
  toPhoneNumberId?: string;
}

// Meta's webhook payload shape: entry[].changes[].value.messages[]. Handles
// plain text, taps on our own interactive messages (button_reply/list_reply),
// and voice notes/audio shares (message.audio = { id, mime_type }, no inline
// bytes — the caller downloads it separately via downloadMedia below).
// Everything else (image, location, etc.) still comes back `null`, since no
// tool in this system's catalog can do anything useful with those yet.
export function parseInboundMessage(payload: unknown): InboundWhatsAppMessage | null {
  const entry = (payload as { entry?: unknown[] })?.entry?.[0] as
    | { changes?: { value?: { messages?: unknown[]; metadata?: { phone_number_id?: string } } }[] }
    | undefined;
  const value = entry?.changes?.[0]?.value;
  const toPhoneNumberId = value?.metadata?.phone_number_id;
  const message = value?.messages?.[0] as
    | {
        from?: string;
        id?: string;
        type?: string;
        text?: { body?: string };
        audio?: { id?: string; mime_type?: string };
        interactive?: {
          type?: string;
          button_reply?: { id?: string };
          list_reply?: { id?: string };
        };
      }
    | undefined;

  if (!message?.from || !message.id) return null;

  if (message.type === 'text' && message.text?.body) {
    return { fromWaPhoneNumber: message.from, text: message.text.body, wamid: message.id, toPhoneNumberId };
  }

  if (message.type === 'audio' && message.audio?.id) {
    return {
      fromWaPhoneNumber: message.from,
      audio: { mediaId: message.audio.id, mimeType: message.audio.mime_type ?? 'audio/ogg' },
      wamid: message.id,
      toPhoneNumberId,
    };
  }

  // A button/list tap's `id` is the full original quick-reply text we sent it
  // as (see sendWhatsAppQuickReplies) — feeding it back through as if the
  // customer typed it themselves keeps the orchestrator's contract (it only
  // ever deals in free text) unchanged.
  if (message.type === 'interactive') {
    const tappedId = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id;
    if (tappedId) return { fromWaPhoneNumber: message.from, text: tappedId, wamid: message.id, toPhoneNumberId };
  }

  return null;
}

// Meta's media API is a two-step fetch: this call returns metadata + a
// temporary signed URL (expires in minutes), then a second authenticated GET
// against that URL gets the actual bytes — neither step is inline in the
// webhook payload itself (message.audio only ever carries an id). Best-
// effort, same reasoning as sendWhatsAppPayload above: a download failure
// must never crash the webhook, just mean this one message can't be understood.
export async function downloadMedia(
  mediaId: string,
  credentials: ResolvedWhatsAppCredentials = 'shared',
): Promise<{ base64: string; mimeType: string } | null> {
  if (credentials === 'broken') {
    console.error(`[whatsapp] refusing to download media ${mediaId} — dedicated-number credentials are broken (not falling back to the shared token)`);
    return null;
  }
  const token = credentials === 'shared' ? process.env.WHATSAPP_CLOUD_API_TOKEN : credentials.token;
  if (!token) {
    console.warn(`[whatsapp] credenciais ausentes — não foi possível baixar mídia ${mediaId}`);
    return null;
  }

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaResponse.ok) {
      console.error(`[whatsapp] media metadata fetch failed (${metaResponse.status}) for ${mediaId}`);
      return null;
    }
    const meta = (await metaResponse.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const fileResponse = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileResponse.ok) {
      console.error(`[whatsapp] media download failed (${fileResponse.status}) for ${mediaId}`);
      return null;
    }
    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    return { base64: buffer.toString('base64'), mimeType: meta.mime_type ?? 'audio/ogg' };
  } catch (err) {
    console.error(`[whatsapp] media download threw for ${mediaId}`, err);
    return null;
  }
}

// This deployment's own country code (WHATSAPP_DEFAULT_COUNTRY_CODE env var,
// e.g. "34" for the Spain deployment) — what a customer typing a phone
// number into the web widget's booking form is assumed to have omitted.
// Empty/unset falls back to "55" (Brazil), matching this codebase's
// original single-market behavior.
function defaultCountryCode(): string {
  return process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '55';
}

// services.ts#normalizePhone already normalizes customer-provided phone
// numbers to 10-11 local digits (no country code) for the booking flow.
// WhatsApp's inbound "from" always includes a country code (e.g.
// "5511987654321", or "34666240157" on the Spain deployment) — stripped
// here so the SAME person is recognized as one Customer record whether they
// arrive via the web widget or WhatsApp. Only strips THIS deployment's own
// country code — a customer messaging from a different country entirely
// keeps their full international number, which still works fine as a
// unique identifier, just isn't "local" formatted.
export function toLocalPhone(waFrom: string): string {
  const digits = waFrom.replace(/\D/g, '');
  const cc = defaultCountryCode();
  return digits.startsWith(cc) && digits.length > 11 ? digits.slice(cc.length) : digits;
}

// Inverse of toLocalPhone — services.ts#createBooking only ever has the
// 10-11 digit local format the customer typed into the web widget (never a
// country code, even when the booking itself came in over WhatsApp), but
// sending a message via the Cloud API needs the full number Meta expects.
// Assumes the widget-typed number is local to THIS deployment's own market
// (see defaultCountryCode above) — correct for the common case (a company's
// own customers are overwhelmingly local to wherever that company operates),
// same assumption normalizePhone already makes about digit count.
export function toWhatsAppPhone(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, '');
  const cc = defaultCountryCode();
  return digits.startsWith(cc) ? digits : `${cc}${digits}`;
}
