// Matches marketing-home.tsx#PRICING — kept as separate hardcoded copy here
// the same way the rest of this codebase's pricing displays already are
// (no shared source of truth for pricing text yet). Order here IS the
// upgrade ladder — dashboard/billing/actions.ts#changePlan uses each plan's
// array index as its rank to block downgrades, so don't reorder this
// without meaning to change what counts as an upgrade.
export const PLANS = [
  { key: 'basico', label: 'Básico', price: 'R$ 197/mês' },
  { key: 'whatsapp_proprio', label: 'WhatsApp próprio', price: 'R$ 397/mês' },
  { key: 'integracao', label: 'Integração com seu sistema', price: 'R$ 997/mês' },
] as const;

export function planRank(key: string): number {
  return PLANS.findIndex((p) => p.key === key);
}

// Launch strategy: give the product away free to build up usage/testimonials
// before ever charging anyone — everyone gets the shared-WhatsApp basic
// experience free, no card, no Stripe subscription. Deliberately a single
// hardcoded flag, not deleted code: every plan/pricing/Stripe code path
// below is still fully intact and works exactly as before the moment this
// flips back to false (see lib/stripe/client.ts#isStripeConfigured, which is
// what actually gates signup/billing behavior off of this).
export const FREE_TIER_MODE = true;

// Only a proxy for "Stripe is configured" (real check is server-side, see
// lib/stripe/client.ts#isStripeConfigured) — but it's what decides whether
// the plan selector renders at all, so that without Stripe set up, signup
// and onboarding look and behave exactly like they did before this feature
// existed.
export const stripeConfiguredOnClient = !FREE_TIER_MODE && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
