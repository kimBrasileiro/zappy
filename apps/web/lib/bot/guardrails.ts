import type { Company, Ticket } from '@zappigo/db';
import { normalizeDomain } from '../domains';

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
}

// G3 — basic heuristic, not a classifier. Blocks the most common
// prompt-injection phrasing and degenerate spam input. Revisit once there's
// a real abuse dataset to tune against.
const INJECTION_PATTERNS = [
  /ignor[ea]\s+(as\s+)?instru[çc][õo]es\s+anteriores/i,
  /you\s+are\s+now\s+(a|an)\b/i,
  /disregard\s+(all\s+)?previous\s+instructions/i,
  /system\s*prompt/i,
];

export function checkMaliciousContent(text: string): GuardrailResult {
  if (INJECTION_PATTERNS.some((re) => re.test(text))) {
    return { allowed: false, reason: 'blocked_prompt_injection' };
  }
  const longestRun = (text.match(/(.)\1{20,}/) ?? [''])[0].length;
  if (longestRun > 20) {
    return { allowed: false, reason: 'blocked_degenerate_input' };
  }
  return { allowed: true };
}

// G4 — real check on company.status.
export function checkCompanyActive(company: Pick<Company, 'status'>): GuardrailResult {
  if (company.status !== 'active') {
    return { allowed: false, reason: 'company_inactive' };
  }
  return { allowed: true };
}

// G4b — monthly per-company message quota, the "quota enforcement" gap
// this file used to flag on checkCompanyActive above. The per-minute rate
// limit in rate-limit.ts only guards against short bursts; it does nothing
// against hours/days of sustained use at that same per-minute rate, which
// is the actual cost-risk scenario on a free-tier product (one abused —
// or one unexpectedly popular — company's shared WhatsApp number running
// up real Gemini spend with no ceiling). A pure sync check on purpose,
// like every other guardrail here: the caller (orchestrator.ts) queries
// this month's real customer-message count directly from the messages
// table — already persisted, nothing new to keep in sync, and it survives
// restarts/multiple instances unlike an in-memory counter would.
export function checkMessageQuota(monthlyMessageCount: number, limit: number): GuardrailResult {
  if (monthlyMessageCount >= limit) {
    return { allowed: false, reason: 'monthly_quota_exceeded' };
  }
  return { allowed: true };
}

// G5 — ticket must exist and not already be resolved/closed.
export function checkTicketContext(ticket: Pick<Ticket, 'status'>): GuardrailResult {
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return { allowed: false, reason: 'ticket_closed' };
  }
  return { allowed: true };
}

// G6 — real now that tools exist (lib/bot/tool-definitions.ts). Not a
// runtime check function: enforced architecturally in orchestrator.ts. The
// model is only ever told a booking succeeded via a 'tool' role message
// containing create_booking's actual result — it has no other way to learn
// booking details, so it structurally cannot confirm one that didn't happen.

// G7 — defense in depth. Every DB query in lib/bot/conversation.ts is already
// scoped by companyId; this is a second, explicit check before the response
// goes out, so a future refactor that forgets a `where: { companyId }` still
// gets caught here.
export function assertNoCrossTenantLeak(ticket: Pick<Ticket, 'companyId'>, companyId: string): void {
  if (ticket.companyId !== companyId) {
    throw new Error('cross_tenant_leak_detected');
  }
}

// G8 — partially mitigated by the same tool-grounding as G6 (booking
// specifics can only come from a real tool result), but still a stub in the
// broader sense: there's no cross-check that arbitrary numbers/dates the
// model states elsewhere in its reply actually match a tool result. Full
// hallucination detection (diffing every claim against tool provenance)
// remains a gap.
export function detectHallucination(): GuardrailResult {
  return { allowed: true };
}

// G9 — real now: orchestrator.ts bounds the loop to at most one business-tool
// round followed by one forced final-answer round (MAX_TOOL_ROUNDS), not a
// runtime check function here.

// G10 — steering, not strict output validation: strict language detection on
// arbitrary LLM output is fragile (regex/langdetect false positives on short
// strings). Instead the system prompt is built to request the company's
// configured language explicitly.
export function resolveLanguage(company: Pick<Company, 'config'>): string {
  const config = company.config as { language?: string } | null;
  return config?.language ?? 'pt-BR';
}

// G11 — the bot only ever goes fully silent once an actual human has
// stepped in (a dashboard agent sent a reply, moving the ticket to
// in_progress) — never merely because escalate_human was called
// (waiting_human). Before an agent actually joins, the customer would
// otherwise be stuck with no help at all for however long the queue takes;
// the bot keeps answering FAQs/bookings/etc. normally in the meantime, it
// just also keeps the ticket flagged for a human (see isEscalated below).
// Bot access resumes only if the ticket is resolved/closed and a new one is
// opened.
export function isHumanActivelyHandling(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status === 'in_progress';
}

// Display-only: true as soon as escalate_human has been called, even before
// anyone's picked it up — drives the widget's "aguardando atendente" banner
// and the escalated flag returned to both channels. Deliberately broader
// than isHumanActivelyHandling above; those two questions ("should the UI
// show escalated" vs. "should the bot stop talking") are answered
// differently on purpose.
export function isEscalated(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status === 'waiting_human' || ticket.status === 'in_progress';
}

// G12 — the widget's <script data-company="slug"> is public by construction
// (it's sitting in the HTML source of whatever page embeds it), so the slug
// alone doesn't prove the caller is that company's own site. An empty
// allowedDomains means the company hasn't locked it down yet (a fresh signup
// can still test the widget anywhere) — once they add at least one domain in
// the dashboard, only that domain (plus the Zappigo app's own demo/preview
// page) may talk to the API as this company. WhatsApp has no Origin header
// and isn't affected — see orchestrator.ts, only checked for site_chat.
export function checkOrigin(company: Pick<Company, 'allowedDomains'>, origin: string | null): GuardrailResult {
  if (company.allowedDomains.length === 0) return { allowed: true };
  if (!origin) return { allowed: false, reason: 'origin_not_allowed' };

  let hostname: string;
  try {
    hostname = normalizeDomain(new URL(origin).hostname);
  } catch {
    return { allowed: false, reason: 'origin_not_allowed' };
  }

  const appHostname = (() => {
    try {
      return normalizeDomain(new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').hostname);
    } catch {
      return null;
    }
  })();
  if (appHostname && hostname === appHostname) return { allowed: true };

  const allowed = company.allowedDomains.some((d) => normalizeDomain(d) === hostname);
  return allowed ? { allowed: true } : { allowed: false, reason: 'origin_not_allowed' };
}
