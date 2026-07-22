import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@zappy/db';
import { getStripe, isBillingActive } from '../../../../lib/stripe/client';
import { sendEmail } from '../../../../lib/email/resend';

// company.status ('active'/'inactive') is the only field guardrails.ts#
// checkCompanyActive reads — every handler below that touches subscription
// state derives that same field from isBillingActive() so the mapping never
// drifts between events.
async function syncSubscriptionStatus(subscription: Stripe.Subscription): Promise<void> {
  const company = await prisma.company.findFirst({ where: { stripeSubscriptionId: subscription.id } });
  if (!company) return;

  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscriptionStatus: subscription.status,
      status: isBillingActive(subscription.status) ? 'active' : 'inactive',
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

async function notifyTrialEnding(subscription: Stripe.Subscription): Promise<void> {
  const company = await prisma.company.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    include: { users: { where: { role: 'admin', status: 'active' }, select: { email: true } } },
  });
  if (!company?.users.length) return;

  await sendEmail(
    company.users.map((u) => u.email),
    'Seu trial da Zappy termina em 3 dias',
    '<p>Seu trial gratuito da Zappy termina em 3 dias. Se você já cadastrou um cartão, a cobrança acontece automaticamente e nenhuma ação é necessária.</p>',
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
