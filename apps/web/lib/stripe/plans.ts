import { PRICE_BASICO } from '../pricing';

// A single plan — the 'basico' key is kept (not renamed) so the existing
// Stripe wiring (STRIPE_PRICE_BASICO in lib/stripe/client.ts#PLAN_PRICE_ENV_VARS,
// the 'plan' column values already stored on real Company rows) doesn't need
// touching. `label` stays a fixed Portuguese string — dashboard/billing/
// actions.ts#changePlan uses it for transactional email content (lib/
// notifications.ts), out of scope for the pt/es/en UI switcher; the
// dashboard's own display looks it up by `key` through messages/*.json
// instead (see dashboard/billing/page.tsx).
export const PLANS = [{ key: 'basico', label: 'Zappigo', price: PRICE_BASICO }] as const;

export function planRank(key: string): number {
  return PLANS.findIndex((p) => p.key === key);
}

// Was true for the free-launch period (build usage/testimonials before
// charging anyone) — flipped to false once Stripe went live (Set/2026).
// Kept as a flag rather than deleted so a future free period (or a
// still-free separate deployment) is a one-line change again, not a revert
// (see lib/stripe/client.ts#isStripeConfigured, which is what actually
// gates signup/billing behavior off of this).
export const FREE_TIER_MODE = false;

// Only a proxy for "Stripe is configured" (real check is server-side, see
// lib/stripe/client.ts#isStripeConfigured) — but it's what decides whether
// the plan selector renders at all, so that without Stripe set up, signup
// and onboarding look and behave exactly like they did before this feature
// existed.
export const stripeConfiguredOnClient = !FREE_TIER_MODE && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
