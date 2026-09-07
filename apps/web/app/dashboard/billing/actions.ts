'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { getStripe, isBillingActive, startTrialSubscription } from '../../../lib/stripe/client';
import { PLANS } from '../../../lib/stripe/plans';
import { notifyBillingEvent } from '../../../lib/notifications';

function planLabel(plan: string): string {
  return PLANS.find((p) => p.key === plan)?.label ?? plan;
}

async function getCompanyWithSubscription(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  return company?.stripeSubscriptionId ? company : null;
}

// Graceful cancel — keeps access through the period already paid for
// instead of revoking immediately, same as every major SaaS billing flow.
// The webhook (api/webhooks/stripe/route.ts) picks up the eventual
// `customer.subscription.deleted` event and flips company.status itself;
// this action only needs to flag the intent on the Stripe side.
export async function cancelSubscription(): Promise<void> {
  // allowInactiveBilling: true — reachable only from /dashboard/billing,
  // which itself renders regardless of billing state (see lib/auth-server.ts).
  const { companyId } = await requireSession({ allowInactiveBilling: true });
  const company = await getCompanyWithSubscription(companyId);
  if (!company) return;

  await getStripe().subscriptions.update(company.stripeSubscriptionId!, { cancel_at_period_end: true });
  // Stripe's subscription.status string doesn't change until the period
  // actually ends (still "trialing"/"active" until then), so this flag is
  // the only place the DB records "will cancel" in the meantime — the
  // webhook re-syncs it too (see api/webhooks/stripe/route.ts), this just
  // means the dashboard reflects it immediately instead of waiting on that
  // round-trip.
  await prisma.company.update({ where: { id: companyId }, data: { cancelAtPeriodEnd: true } });
  await notifyBillingEvent({ companyId, event: 'subscription_canceled', planLabel: planLabel(company.plan) });
  revalidatePath('/dashboard/billing');
}

export interface StartSubscriptionState {
  clientSecret?: string;
  success?: boolean;
  error?: string;
}

// The self-serve fix for landing on this page with no subscription at all —
// either a genuinely new company, or (the real incident this exists for)
// signup's own startTrialSubscription call having silently failed to ever
// create one. Reuses the exact same helper signup/actions.ts calls, so the
// resulting subscription/trial/webhook behavior is identical either way.
export async function startSubscription(): Promise<StartSubscriptionState> {
  // allowInactiveBilling: true — this IS how a company with no subscription
  // gets one; requireSession's own gate would otherwise redirect right back
  // to this same page before the action ever ran.
  const { companyId, email } = await requireSession({ allowInactiveBilling: true });
  const t = await getTranslations('dashboard.billing');

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, stripeSubscriptionId: true },
  });
  if (!company) return { error: t('errorNoActiveSubscription') };
  if (company.stripeSubscriptionId) {
    // Already has one (a concurrent click, or a webhook that beat this
    // request to it) — nothing to start, just let the page re-render its
    // normal subscription view.
    revalidatePath('/dashboard/billing');
    return { success: true };
  }

  const clientSecret = await startTrialSubscription({ companyId, companyName: company.name, email, plan: 'basico' });
  revalidatePath('/dashboard/billing');
  if (clientSecret) return { clientSecret };

  // No SetupIntent came back — startTrialSubscription may still have created
  // a real (trialing) subscription: Stripe doesn't always generate one for a
  // trial with nothing due yet, that's not the same as the call having
  // failed (see the missing-price-id branch inside startTrialSubscription,
  // which is the actual failure case). Re-check the real state rather than
  // assume the worse of the two.
  const fresh = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true, stripeSubscriptionId: true, hasPaymentMethod: true },
  });
  if (fresh?.stripeSubscriptionId && isBillingActive(fresh.subscriptionStatus, fresh.hasPaymentMethod)) {
    return { success: true };
  }
  return { error: t('errorStartSubscriptionFailed') };
}

// For a subscription that already exists but has no card on file yet — the
// real-world gap this closes: startSubscription/signup's SetupIntent step
// only ever gets shown once, right when the subscription is first created,
// so anyone who dismissed that screen (or the older code path before this
// fix, which sometimes skipped it) needs a way back to it.
export async function addPaymentMethod(): Promise<StartSubscriptionState> {
  // allowInactiveBilling: true — collecting a card is exactly how an
  // inactive-for-lack-of-payment-method company gets itself unstuck.
  const { companyId } = await requireSession({ allowInactiveBilling: true });
  const t = await getTranslations('dashboard.billing');
  const company = await getCompanyWithSubscription(companyId);
  if (!company?.stripeCustomerId) return { error: t('errorNoActiveSubscription') };

  const setupIntent = await getStripe().setupIntents.create({
    customer: company.stripeCustomerId,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: { companyId, subscriptionId: company.stripeSubscriptionId! },
  });
  return { clientSecret: setupIntent.client_secret ?? undefined };
}

export async function reactivateSubscription(): Promise<void> {
  // allowInactiveBilling: true — this is the whole point of the action:
  // undoing a cancel-at-period-end while the company can still be inactive.
  const { companyId } = await requireSession({ allowInactiveBilling: true });
  const company = await getCompanyWithSubscription(companyId);
  if (!company) return;

  await getStripe().subscriptions.update(company.stripeSubscriptionId!, { cancel_at_period_end: false });
  await prisma.company.update({ where: { id: companyId }, data: { cancelAtPeriodEnd: false } });
  await notifyBillingEvent({ companyId, event: 'subscription_reactivated', planLabel: planLabel(company.plan) });
  revalidatePath('/dashboard/billing');
}

