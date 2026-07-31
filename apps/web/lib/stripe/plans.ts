import { PRICE_BASICO, PRICE_WHATSAPP_PROPRIO, PRICE_INTEGRACAO } from '../pricing';

// Amounts come from lib/pricing.ts (deployment config, not hardcoded BRL) so
// a separately deployed instance with its own Stripe account/currency (e.g.
// a EUR-billing Spain deployment) shows its own real prices here too — this
// used to hardcode "R$ 197/mês" etc, the same class of bug the marketing
// page had before PRICING_CURRENCY_* was introduced. `label` stays a fixed
// Portuguese string — dashboard/billing/actions.ts#changePlan uses it for
// transactional email content (lib/notifications.ts), which is out of scope
// for the pt/es/en UI switcher; the dashboard's own display of these plans
// looks it up by `key` through messages/*.json instead (see
// dashboard/billing/page.tsx and change-plan-form.tsx). Order here IS the
// upgrade ladder — dashboard/billing/actions.ts#changePlan uses each plan's
// array index as its rank to block downgrades, so don't reorder this
// without meaning to change what counts as an upgrade.
export const PLANS = [
  { key: 'basico', label: 'Básico', price: PRICE_BASICO },
  { key: 'whatsapp_proprio', label: 'WhatsApp próprio', price: PRICE_WHATSAPP_PROPRIO },
  { key: 'integracao', label: 'Integração com seu sistema', price: PRICE_INTEGRACAO },
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
