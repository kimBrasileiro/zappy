'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { getStripe, isPlanKey, priceIdForPlan } from '../../../lib/stripe/client';
import { PLANS, planRank } from '../../../lib/stripe/plans';
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
  const { companyId } = await requireSession();
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

export async function reactivateSubscription(): Promise<void> {
  const { companyId } = await requireSession();
  const company = await getCompanyWithSubscription(companyId);
  if (!company) return;

  await getStripe().subscriptions.update(company.stripeSubscriptionId!, { cancel_at_period_end: false });
  await prisma.company.update({ where: { id: companyId }, data: { cancelAtPeriodEnd: false } });
  await notifyBillingEvent({ companyId, event: 'subscription_reactivated', planLabel: planLabel(company.plan) });
  revalidatePath('/dashboard/billing');
}

export interface ChangePlanState {
  error?: string;
}

export async function changePlan(_prevState: ChangePlanState, formData: FormData): Promise<ChangePlanState> {
  const { companyId } = await requireSession();

  const planRaw = String(formData.get('plan') ?? '');
  if (!isPlanKey(planRaw)) {
    return { error: 'Plano inválido.' };
  }
  if (formData.get('confirm') !== 'on') {
    return { error: 'Confirma a troca de plano e o aceite dos Termos pra continuar.' };
  }

  const company = await getCompanyWithSubscription(companyId);
  if (!company) {
    return { error: 'Nenhuma assinatura ativa pra alterar.' };
  }

  if (company.plan === planRaw) {
    return {};
  }

  // Self-service is upgrade-only — a downgrade changes what the customer's
  // already relying on (e.g. loses their own WhatsApp number), so it goes
  // through support instead of a single click on the dashboard.
  if (planRank(planRaw) < planRank(company.plan)) {
    return { error: 'Downgrade de plano não é feito por aqui — fale com o suporte.' };
  }

  const priceId = priceIdForPlan(planRaw);
  if (!priceId) {
    return { error: 'Esse plano ainda não está disponível — fale com o suporte.' };
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId!);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    return { error: 'Não foi possível localizar sua assinatura no Stripe — fale com o suporte.' };
  }

  // Prorated immediately (upgrade: charged now for the difference; downgrade:
  // credited on the next invoice) — no surprise full-price charge either way.
  await stripe.subscriptions.update(company.stripeSubscriptionId!, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
  });

  // Mirrors what the webhook would eventually sync anyway (subscription.
  // updated only touches status/trial fields, never `plan` — see
  // syncSubscriptionStatus in api/webhooks/stripe/route.ts) — updated here
  // directly so the dashboard reflects the new plan without waiting on the
  // webhook round-trip.
  await prisma.company.update({ where: { id: companyId }, data: { plan: planRaw } });
  await notifyBillingEvent({ companyId, event: 'plan_changed', planLabel: planLabel(planRaw) });

  revalidatePath('/dashboard/billing');
  return {};
}
