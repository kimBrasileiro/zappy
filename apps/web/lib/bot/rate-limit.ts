// G2 — in-memory sliding window. Fine for a single Next.js server process;
// swap for a Redis-backed counter once BullMQ/Redis is wired up (multiple
// instances would each keep their own counter otherwise).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

const hits = new Map<string, number[]>();

function slidingWindowCheck(key: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
  timestamps.push(now);
  hits.set(key, timestamps);

  return timestamps.length <= maxRequests;
}

export function checkRateLimit(companyId: string, customerKey: string): { allowed: boolean } {
  return { allowed: slidingWindowCheck(`msg:${companyId}:${customerKey}`, WINDOW_MS, MAX_REQUESTS_PER_WINDOW) };
}

// A malicious/scripted client can trivially mint a fresh conversationId per
// request (it's just a client-side localStorage value), which sidesteps the
// per-conversation message limit above entirely. These two checks target
// booking creation specifically — by claimed phone number (a real customer
// doesn't book the same business several times a day) and company-wide (a
// backstop against flooding the calendar with many different fake numbers)
// — so a bot can't mass-create bookings "on behalf of" people.
const BOOKING_PHONE_WINDOW_MS = 24 * 60 * 60_000;
const MAX_BOOKINGS_PER_PHONE_PER_DAY = 3;
const BOOKING_COMPANY_WINDOW_MS = 60 * 60_000;
const MAX_BOOKINGS_PER_COMPANY_PER_HOUR = 30;

export function checkBookingRateLimit(companyId: string, phone: string): { allowed: boolean; reason?: string } {
  if (!slidingWindowCheck(`booking-phone:${companyId}:${phone}`, BOOKING_PHONE_WINDOW_MS, MAX_BOOKINGS_PER_PHONE_PER_DAY)) {
    return { allowed: false, reason: 'too_many_bookings_this_phone' };
  }
  if (!slidingWindowCheck(`booking-company:${companyId}`, BOOKING_COMPANY_WINDOW_MS, MAX_BOOKINGS_PER_COMPANY_PER_HOUR)) {
    return { allowed: false, reason: 'too_many_bookings_company_wide' };
  }
  return { allowed: true };
}

// Same dual-layer shape as checkBookingRateLimit above, applied to
// human-agent-composed WhatsApp sends (dashboard/conversations/[ticketId]/
// actions.ts#sendAgentReply) — a WABA ban-risk guardrail, not a UX one. The
// per-agent window catches one runaway agent/browser bug/script; the
// per-company window catches the same risk aggregated across an entire
// team, which the per-agent check alone can't see. Thresholds are set well
// above realistic human typing speed (no support agent sends 10 distinct
// WhatsApp replies inside one minute) so normal usage is never throttled.
const AGENT_OUTBOUND_WINDOW_MS = 60_000;
const MAX_OUTBOUND_PER_AGENT_PER_MINUTE = 10;
const COMPANY_OUTBOUND_WINDOW_MS = 60 * 60_000;
const MAX_OUTBOUND_PER_COMPANY_PER_HOUR = 200;

export function checkOutboundRateLimit(companyId: string, agentUserId: string): { allowed: boolean; reason?: string } {
  if (!slidingWindowCheck(`outbound-agent:${companyId}:${agentUserId}`, AGENT_OUTBOUND_WINDOW_MS, MAX_OUTBOUND_PER_AGENT_PER_MINUTE)) {
    return { allowed: false, reason: 'too_many_agent_sends' };
  }
  if (!slidingWindowCheck(`outbound-company:${companyId}`, COMPANY_OUTBOUND_WINDOW_MS, MAX_OUTBOUND_PER_COMPANY_PER_HOUR)) {
    return { allowed: false, reason: 'too_many_company_sends' };
  }
  return { allowed: true };
}
