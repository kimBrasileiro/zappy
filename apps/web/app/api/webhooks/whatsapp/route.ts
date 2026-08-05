import { NextResponse } from 'next/server';
import { prisma } from '@zappigo/db';
import { resolveWhatsAppRoute } from '../../../../lib/bot/conversation';
import { OrchestratorBlockedError, orchestrate } from '../../../../lib/bot/orchestrator';
import { transcribeAudio } from '../../../../lib/ai/gemini';
import {
  downloadMedia,
  parseInboundMessage,
  resolveWhatsAppCredentials,
  sendWhatsAppMessage,
  sendWhatsAppQuickReplies,
  verifyWebhookSignature,
} from '../../../../lib/whatsapp/client';

const NEEDS_CODE_MESSAGE =
  'Oi! Esse número atende várias empresas — me diga o nome da empresa que você quer falar (ex: "quero falar com a Zappigo") que eu já te conecto.';

const AUDIO_UNDERSTOOD_FAILED_MESSAGE =
  'Não consegui entender esse áudio — pode tentar gravar de novo, ou escrever a mensagem?';

// Meta re-delivers a webhook event if it doesn't get a fast 200, or on any
// transient error on its side — dedup by message id (wamid) so a retry never
// creates a second ticket message or sends a second reply. In-memory Set is
// fine here for the same reason lib/bot/rate-limit.ts's sliding window is:
// single Next.js server process, no multi-instance deployment yet.
const seenWamids = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60_000;

function isDuplicate(wamid: string): boolean {
  const now = Date.now();
  for (const [id, seenAt] of seenWamids) {
    if (now - seenAt > DEDUP_TTL_MS) seenWamids.delete(id);
  }
  if (seenWamids.has(wamid)) return true;
  seenWamids.set(wamid, now);
  return false;
}

// Collects orchestrate()'s streamed deltas into one string — WhatsApp has no
// concept of a streaming reply, unlike the SSE-based /api/chat endpoint —
// and keeps its final quickReplies (same contextual suggestions the web
// widget renders as chips; see api/chat/route.ts's "options" frame), sent
// here as real WhatsApp buttons/list instead.
async function collectReply(
  input: Parameters<typeof orchestrate>[0],
): Promise<{ text: string; quickReplies: string[] }> {
  const gen = orchestrate(input);
  let full = '';
  for (;;) {
    const next = await gen.next();
    if (next.done) return { text: full, quickReplies: next.value.quickReplies };
    full += next.value;
  }
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

export async function POST(request: Request) {
  // Signature verification needs the exact raw bytes Meta signed — parsing
  // JSON first and re-serializing it would not necessarily round-trip
  // byte-for-byte (key order, whitespace), so the signature has to be
  // checked against request.text(), not request.json().
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const inbound = parseInboundMessage(payload);
  // Always 200 — this covers both "not a text message" (nothing this system
  // can act on yet) and a genuinely malformed payload; Meta interprets any
  // non-200 as "retry me", which would just repeat the same no-op forever.
  if (!inbound) return NextResponse.json({ ok: true });
  if (isDuplicate(inbound.wamid)) return NextResponse.json({ ok: true });

  // Resolved ONCE, up front, from Meta's own verified phone_number_id — not
  // from anything a customer typed. Everything downstream in this handler
  // (media download, every reply) uses these same credentials for this
  // message, so a message that arrived on a company's own private number
  // never touches the shared platform number in either direction. See
  // lib/bot/conversation.ts#resolveWhatsAppRoute for the matching inbound-
  // routing guarantee.
  const dedicatedCompany = inbound.toPhoneNumberId
    ? await prisma.company.findFirst({ where: { whatsappPhoneId: inbound.toPhoneNumberId, status: 'active' } })
    : null;
  const credentials = dedicatedCompany ? resolveWhatsAppCredentials(dedicatedCompany) : 'shared';

  // Voice note: resolve it to real text BEFORE routing — resolveWhatsAppRoute
  // itself needs actual text (Z:slug / company-name matching), so this can't
  // wait until orchestrate() the way the rest of this handler might suggest.
  // Its Gemini cost still ends up attributed correctly: carried forward as
  // pretranscribedUsage below and folded into this same turn's cost tracking
  // in orchestrator.ts, not a separate untracked spend.
  let text = inbound.text;
  let pretranscribedUsage: { costUsd: number; promptTokens: number; completionTokens: number } | undefined;
  if (!text && inbound.audio) {
    const media = await downloadMedia(inbound.audio.mediaId, credentials);
    const transcription = media ? await transcribeAudio(media.base64, media.mimeType) : null;
    if (!transcription) {
      await sendWhatsAppMessage(inbound.fromWaPhoneNumber, AUDIO_UNDERSTOOD_FAILED_MESSAGE, credentials);
      return NextResponse.json({ ok: true });
    }
    text = transcription.text;
    pretranscribedUsage = {
      costUsd: transcription.costUsd,
      promptTokens: transcription.promptTokens,
      completionTokens: transcription.completionTokens,
    };
  }
  if (!text) return NextResponse.json({ ok: true }); // neither text nor audio resolved — nothing to act on

  const route = await resolveWhatsAppRoute(inbound.fromWaPhoneNumber, text, dedicatedCompany);
  if (route.needsCode) {
    await sendWhatsAppMessage(inbound.fromWaPhoneNumber, NEEDS_CODE_MESSAGE, credentials);
    return NextResponse.json({ ok: true });
  }
  if (route.needsConfirmation) {
    await sendWhatsAppQuickReplies(
      inbound.fromWaPhoneNumber,
      `Olá! Você gostaria de agendar serviços ou suporte com a ${route.company.name}? Se for outra empresa, é só me dizer o nome dela.`,
      ['Sim', 'Não'],
      credentials,
    );
    return NextResponse.json({ ok: true });
  }

  try {
    const { text: reply, quickReplies } = await collectReply({
      companySlug: route.company.slug,
      channel: 'whatsapp',
      conversationId: route.customer.phone!,
      message: route.message,
      isNewContext: route.isSwitch,
      pretranscribedUsage,
    });
    // Empty only happens for a channel/guardrail case orchestrate() itself
    // has nothing to say about — G11 (already human-handled) now always
    // returns real text (see orchestrator.ts's STILL_ESCALATED_MESSAGE), so
    // this isn't that.
    if (reply) await sendWhatsAppQuickReplies(inbound.fromWaPhoneNumber, reply, quickReplies, credentials);
  } catch (err) {
    if (!(err instanceof OrchestratorBlockedError)) {
      console.error('[whatsapp] orchestrate failed', err);
    }
    // Blocked (rate-limited, inactive company, etc.) or unexpected error —
    // stay silent rather than exposing internal guardrail reasons over
    // WhatsApp; the customer can just try again.
  }

  return NextResponse.json({ ok: true });
}
