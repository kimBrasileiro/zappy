import Stripe from 'stripe';
import { prisma } from '@zappigo/db';
import { PLANS, FREE_TIER_MODE } from './plans';
import { notifyBillingEvent } from '../notifications';

let client: Stripe | null = null;

// Gates the entire Stripe-backed signup flow (see signup/actions.ts) — with
// no key configured, signup falls back to the pre-Stripe behavior (no plan,
// no card, immediate active company) rather than half-rendering a payment
// step that can't actually work. This is what lets local dev keep working
// without ever needing a Stripe account. FREE_TIER_MODE (plans.ts) forces
// this false too, regardless of whether real keys are present — the launch
// strategy is "free for everyone right now", not "free only where we forgot
// to configure billing".
export function isStripeConfigured(): boolean {
  return !FREE_TIER_MODE && !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (!client) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(apiKey);
  }
  return client;
}

// The single plan (plans.ts#PLANS) — needs a real Price object created in
// Stripe; the env var just holds that Price's id (price_...).
export const PLAN_PRICE_ENV_VARS = {
  basico: 'STRIPE_PRICE_BASICO',
} as const;

export type PlanKey = keyof typeof PLAN_PRICE_ENV_VARS;

export function isPlanKey(value: string): value is PlanKey {
  return value in PLAN_PRICE_ENV_VARS;
}

export function priceIdForPlan(plan: PlanKey): string | null {
  return process.env[PLAN_PRICE_ENV_VARS[plan]] ?? null;
}

// Company.status ('active' | 'inactive') is the only thing
// guardrails.ts#checkCompanyActive looks at, and lib/auth-server.ts's own
// dashboard billing gate uses this same function — the single place that
// decides what "billing is really active" means, so the two can't drift
// apart. "trialing" alone is deliberately NOT enough: Stripe lets a
// trialing subscription exist with zero payment method attached (see
// startTrialSubscription's own comment on pending_setup_intent always being
// null for a trial) — a company that started the flow but never actually
// finished the card step must stay gated, not get in on the trial's status
// string alone. "active" already proves a card worked (Stripe couldn't have
// billed the first invoice without one), so it doesn't need this check.
export function isBillingActive(subscriptionStatus: string | null, hasPaymentMethod: boolean): boolean {
  if (subscriptionStatus === 'active') return true;
  if (subscriptionStatus === 'trialing') return hasPaymentMethod;
  return false;
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

  await notifyBillingEvent({
    companyId: params.companyId,
    event: 'subscription_created',
    planLabel: PLANS.find((p) => p.key === params.plan)?.label ?? params.plan,
  });

  // Confirmed against Stripe directly: a trialing subscription's own
  // pending_setup_intent stays null — there's no invoice due yet for Stripe
  // to attach one to, regardless of payment_behavior/payment_settings above
  // (those only govern what happens once a REAL invoice shows up, at trial
  // end). Collecting a card up front (so trial-abuse is prevented and the
  // trial-end charge doesn't just fail) needs its own, explicit SetupIntent
  // — api/webhooks/stripe/route.ts#setup_intent.succeeded is what actually
  // attaches the resulting payment method to this subscription once the
  // customer confirms it.
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: { companyId: params.companyId, subscriptionId: subscription.id },
  });
  return setupIntent.client_secret;
}
