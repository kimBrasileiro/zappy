import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@zappigo/db';
import { getStripe, isBillingActive } from '../../../../lib/stripe/client';
import { sendEmail } from '../../../../lib/email/resend';

// company.status ('active'/'inactive') is the only field guardrails.ts#
// checkCompanyActive reads — every handler below that touches subscription
// state derives that same field from isBillingActive() so the mapping never
// drifts between events.
async function syncSubscriptionStatus(subscription: Stripe.Subscription): Promise<void> {
  const company = await prisma.company.findFirst({ where: { stripeSubscriptionId: subscription.id } });
  if (!company) return;

  // default_payment_method is a plain field on every subscription payload
  // (no expand needed) — string id once set, null until then. Derived fresh
  // from Stripe's own object rather than trusting whatever this same row
  // already had, so this self-heals if attachConfirmedPaymentMethod's direct
  // write below and this event ever raced or missed each other.
  const hasPaymentMethod = !!subscription.default_payment_method;

  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscriptionStatus: subscription.status,
      hasPaymentMethod,
      status: isBillingActive(subscription.status, hasPaymentMethod) ? 'active' : 'inactive',
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      // Re-synced here regardless of source — dashboard/billing/actions.ts
      // already sets this immediately for our own UI, but a subscription
      // changed directly in the Stripe dashboard (or by Stripe itself,
      // e.g. dunning) would otherwise never update it.
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

async function markPastDue(subscriptionId: string): Promise<void> {
  await prisma.company.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { subscriptionStatus: 'past_due', status: 'inactive' },
  });
}

// Attaches the card the customer just confirmed (via <PaymentStep>, off the
// standalone SetupIntent lib/stripe/client.ts#startTrialSubscription creates
// — a trialing subscription never gets its own pending_setup_intent, since
// there's no invoice due yet to attach one to) to the subscription so it's
// actually charged automatically when the trial ends, instead of the
// trial-end invoice failing for lack of a payment method.
async function attachConfirmedPaymentMethod(setupIntent: Stripe.SetupIntent): Promise<void> {
  const { companyId, subscriptionId } = setupIntent.metadata ?? {};
  const paymentMethod = setupIntent.payment_method;
  if (!subscriptionId || !paymentMethod) return;

  const stripe = getStripe();
  await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: typeof paymentMethod === 'string' ? paymentMethod : paymentMethod.id,
  });

  // Written directly (not just left to the customer.subscription.updated
  // event this same subscriptions.update call triggers) so dashboard access
  // unlocks the moment the card is confirmed, not after a second webhook
  // round-trip — companyId is on this SetupIntent's own metadata (see
  // lib/stripe/client.ts#startTrialSubscription/addPaymentMethod), no lookup
  // needed.
  if (companyId) {
    await prisma.company.update({
      where: { id: companyId },
      data: { hasPaymentMethod: true, status: 'active' },
    });
  }
}

async function notifyTrialEnding(subscription: Stripe.Subscription): Promise<void> {
  const company = await prisma.company.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    include: { users: { where: { role: 'admin', status: 'active' }, select: { email: true } } },
  });
  if (!company?.users.length) return;

  await sendEmail(
    company.users.map((u) => u.email),
    'Seu trial da Zappigo termina em 3 dias',
    '<p>Seu trial gratuito da Zappigo termina em 3 dias. Se você já cadastrou um cartão, a cobrança acontece automaticamente e nenhuma ação é necessária.</p>',
  );
}

export async function POST(request: Request) {
  // Signature verification needs the exact raw bytes Stripe signed — same
  // reasoning as the WhatsApp webhook (app/api/webhooks/whatsapp/route.ts):
  // request.text(), never request.json() first.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe] invalid webhook signature', err);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscriptionStatus(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.subscription === 'string') await markPastDue(invoice.subscription);
        break;
      }
      case 'customer.subscription.trial_will_end':
        await notifyTrialEnding(event.data.object as Stripe.Subscription);
        break;
      case 'setup_intent.succeeded':
        await attachConfirmedPaymentMethod(event.data.object as Stripe.SetupIntent);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe] failed handling ${event.type}`, err);
    // Still 200 — Stripe retries on non-2xx, and a DB hiccup here shouldn't
    // cause the same event to hammer this endpoint repeatedly.
  }

  return NextResponse.json({ received: true });
}
