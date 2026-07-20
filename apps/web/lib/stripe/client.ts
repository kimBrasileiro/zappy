import Stripe from 'stripe';

let client: Stripe | null = null;

// Gates the entire Stripe-backed signup flow (see signup/actions.ts) — with
// no key configured, signup falls back to the pre-Stripe behavior (no plan,
// no card, immediate active company) rather than half-rendering a payment
// step that can't actually work. This is what lets local dev keep working
// without ever needing a Stripe account.
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (!client) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(apiKey);
  }
  return client;
}

// The 3 tiers from the marketing page (marketing-home.tsx#PRICING) — each
// needs a real Price object created in the Stripe dashboard once there's an
// account; the env var just holds that Price's id (price_...).
export const PLAN_PRICE_ENV_VARS = {
  basico: 'STRIPE_PRICE_BASICO',
  whatsapp_proprio: 'STRIPE_PRICE_WHATSAPP_PROPRIO',
  integracao: 'STRIPE_PRICE_INTEGRACAO',
} as const;

export type PlanKey = keyof typeof PLAN_PRICE_ENV_VARS;

export function isPlanKey(value: string): value is PlanKey {
  return value in PLAN_PRICE_ENV_VARS;
}

export function priceIdForPlan(plan: PlanKey): string | null {
  return process.env[PLAN_PRICE_ENV_VARS[plan]] ?? null;
}

// Company.status ('active' | 'inactive') is the only thing
// guardrails.ts#checkCompanyActive looks at — this is the single place that
// decides what each Stripe subscription status means for that gate, so the
// mapping can't drift between the webhook handler and anywhere else that
// might need it later.
export function isBillingActive(subscriptionStatus: string | null): boolean {
  return subscriptionStatus === 'trialing' || subscriptionStatus === 'active';
}
