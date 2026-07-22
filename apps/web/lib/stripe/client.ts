import Stripe from 'stripe';
import { prisma } from '@zappy/db';

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

// Shared by both places a company gets created with billing already wired up
// — email/password signup (signup/actions.ts) and the Google OAuth onboarding
// flow (onboarding/actions.ts), so a customer can't get an active company
// without either failing this step or landing on the card-collection screen
// either way. Returns the SetupIntent client secret to hand to <PaymentStep>,
// or null if there's nothing further to collect (caller should redirect to
// /dashboard in that case — the company is already created and usable, the
// webhook picks up the real subscription status later regardless).
export async function startTrialSubscription(params: {
  companyId: string;
  companyName: string;
  email: string;
  plan: PlanKey;
}): Promise<string | null> {
  const priceId = priceIdForPlan(params.plan);
  if (!priceId) {
    // Key is set but the Price id for this specific plan isn't — a config
    // gap, not something the customer did wrong.
    console.error(`[stripe] price id ausente para o plano "${params.plan}" (empresa ${params.companyId} criada sem assinatura)`);
    return null;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.companyName,
    metadata: { companyId: params.companyId },
  });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: 7,
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['pending_setup_intent'],
  });

  await prisma.company.update({
    where: { id: params.companyId },
    data: {
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
  });

  const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null;
  return setupIntent?.client_secret ?? null;
}
