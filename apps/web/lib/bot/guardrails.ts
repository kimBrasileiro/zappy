import type { Company, Ticket } from '@zappy/db';

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

// G4 — real check on company.status. Quota isn't implemented yet (no usage
// counters exist), so quota enforcement is a documented gap, not a check.
export function checkCompanyActive(company: Pick<Company, 'status'>): GuardrailResult {
  if (company.status !== 'active') {
    return { allowed: false, reason: 'company_inactive' };
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

// G11 — once a human is handling the ticket (escalate_human moved it to
// waiting_human, or a dashboard agent reply moved it to in_progress), the bot
// goes silent: the customer's message is still recorded so the lojista sees
// it in the Inbox thread, but no LLM call happens, so the bot and the human
// never answer over each other. Bot access resumes only if the ticket is
// resolved/closed and a new one is opened.
export function isHumanHandling(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status === 'waiting_human' || ticket.status === 'in_progress';
}
