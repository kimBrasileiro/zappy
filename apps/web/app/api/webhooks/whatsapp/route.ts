import { NextResponse } from 'next/server';
import { resolveWhatsAppRoute } from '../../../../lib/bot/conversation';
import { OrchestratorBlockedError, orchestrate } from '../../../../lib/bot/orchestrator';
import { parseInboundMessage, sendWhatsAppMessage, verifyWebhookSignature } from '../../../../lib/whatsapp/client';

const NEEDS_CODE_MESSAGE =
  'Oi! Esse número atende várias empresas — me diga o nome da empresa que você quer falar (ex: "quero falar com a Zappy") que eu já te conecto.';

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
// concept of a streaming reply, unlike the SSE-based /api/chat endpoint.
async function collectReply(
  input: Parameters<typeof orchestrate>[0],
): Promise<string> {
  const gen = orchestrate(input);
  let full = '';
  for (;;) {
    const next = await gen.next();
    if (next.done) break;
    full += next.value;
  }
  return full;
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

  const route = await resolveWhatsAppRoute(inbound.fromWaPhoneNumber, inbound.text);
  if (route.needsCode) {
    await sendWhatsAppMessage(inbound.fromWaPhoneNumber, NEEDS_CODE_MESSAGE);
    return NextResponse.json({ ok: true });
  }

  try {
    const reply = await collectReply({
      companySlug: route.company.slug,
      channel: 'whatsapp',
      conversationId: route.customer.phone!,
      message: route.message,
    });
    // Empty means the ticket is already human-handled (G11 in
    // orchestrator.ts) — nothing to send, same as the widget's own handling
    // of an empty reply.
    if (reply) await sendWhatsAppMessage(inbound.fromWaPhoneNumber, reply);
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
