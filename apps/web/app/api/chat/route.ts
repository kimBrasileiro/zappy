import { NextResponse } from 'next/server';
import { OrchestratorBlockedError, orchestrate, type OrchestrateResult } from '../../../lib/bot/orchestrator';
import { isSupportedLocale } from '../../../i18n/locales';

// The widget is designed to be embedded on arbitrary third-party domains
// (single <script> tag, no changes to the host site), so this endpoint is
// intentionally cross-origin. Restricting to a per-company allow-list of
// registered domains is a later hardening step — there's no domain registry
// to check against yet.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let body: { companyId?: string; conversationId?: string; message?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: CORS_HEADERS });
  }

  const { companyId, conversationId, message } = body;
  // Only the Zappigo marketing site's own widget sends this (see
  // orchestrator.ts's OrchestrateInput.language) — validated against the
  // fixed supported-locale list rather than trusted as free text, since
  // this endpoint is public/cross-origin and the value flows straight into
  // the model's system prompt.
  const language = isSupportedLocale(body.language) ? body.language : undefined;
  if (!companyId || !conversationId || !message?.trim()) {
    return NextResponse.json(
      { error: 'missing_fields' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const encoder = new TextEncoder();

  let generator: AsyncGenerator<string, OrchestrateResult, unknown>;
  let first: IteratorResult<string, OrchestrateResult>;
  try {
    // Cloud Run sits behind Google's load balancer, which sets this header;
    // the first entry is the original client (see rate-limit.ts#checkRateLimit
    // for why this matters — the client-supplied conversationId alone isn't
    // a safe rate-limit key on a public, cross-origin endpoint like this one).
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    generator = orchestrate({
      companySlug: companyId,
      channel: 'site_chat',
      conversationId,
      message,
      origin: request.headers.get('origin'),
      clientIp,
      language,
    });
    // Force guardrail checks (which run before the first `yield`) to execute
    // now, so a blocked/invalid request returns a clean JSON error instead of
    // a stream that opens and then immediately errors.
    first = await generator.next();
  } catch (err) {
    if (err instanceof OrchestratorBlockedError) {
      return NextResponse.json(
        { error: err.reason },
        { status: 422, headers: CORS_HEADERS },
      );
    }
    console.error('[chat] orchestrator failed to start', err);
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // Frames are JSON, not raw text — a raw `data: ${delta}\n\n` breaks when
  // `delta` itself contains a literal blank line (common in markdown, e.g.
  // between an intro sentence and a numbered list), since the client splits
  // on "\n\n" to find frame boundaries. JSON.stringify escapes newlines as
  // the two characters `\n`, so a frame's payload never contains a raw
  // newline and can't be mistaken for a frame boundary.
  // Swallows enqueue failures rather than throwing — if the client already
  // disconnected (closed tab, dropped connection), the platform can close the
  // controller out from under us mid-stream; there's no one left to receive
  // further frames, so this is a no-op, not an error to propagate.
  function sendFrame(controller: ReadableStreamDefaultController<Uint8Array>, payload: unknown): void {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
    } catch {
      // controller already closed — nothing to do.
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // orchestrate() can finish on this very first `.next()` call with
        // zero yields (G11 — a human agent already has the ticket, the bot
        // goes fully silent) — `first.done` is then already true and
        // `first.value` already holds the real OrchestrateResult. Calling
        // `.next()` again on an exhausted generator (as the loop below does)
        // just returns `{done: true, value: undefined}`, which would
        // silently throw away that result (losing `escalated`/quickReplies)
        // if it weren't captured here first.
        let result: OrchestrateResult | undefined;
        if (first.done) {
          result = first.value;
        } else if (first.value) {
          sendFrame(controller, { type: 'delta', text: first.value });
        }

        if (!first.done) {
          for (;;) {
            const next = await generator.next();
            if (next.done) {
              result = next.value;
              break;
            }
            sendFrame(controller, { type: 'delta', text: next.value });
          }
        }

        if (result?.quickReplies?.length) {
          sendFrame(controller, { type: 'options', options: result.quickReplies });
        }
        sendFrame(controller, { type: 'done', escalated: result?.escalated ?? false });
      } catch (err) {
        console.error('[chat] stream failed mid-flight', err);
        sendFrame(controller, { type: 'error' });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by the platform (client disconnected) — fine.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
