import type { Company } from '@zappigo/db';

// G4b's default (see guardrails.ts#checkMessageQuota) — roughly 1.5x the
// ~300 msgs/month moderate-usage assumption used for the cost projections in
// the pitch deck, so a genuinely busy (not abusive) small business still has
// real headroom, while bounding worst-case Gemini spend from one abused/
// runaway conversation to well under a dollar a month instead of hundreds.
// Never surfaced to the customer — the reply on exceeding it
// (orchestrator.ts) reads as "we're busy," not "you hit a limit." Shared
// between orchestrator.ts (enforcement) and the admin usage page (display)
// so the two can't drift.
export const DEFAULT_MONTHLY_MESSAGE_LIMIT = 500;

export function getMonthlyMessageLimit(company: Pick<Company, 'config'>): number {
  const config = company.config as { monthlyMessageLimit?: number } | null;
  return config?.monthlyMessageLimit ?? DEFAULT_MONTHLY_MESSAGE_LIMIT;
}

export function currentMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
