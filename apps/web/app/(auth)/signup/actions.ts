'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type Stripe from 'stripe';
import { prisma } from '@zappy/db';
import { auth } from '../../../lib/auth';
import { generateUniqueSlug } from '../../../lib/slug';
import { createDefaultFaqs } from '../../../lib/default-faqs';
import { getStripe, isPlanKey, isStripeConfigured, priceIdForPlan, type PlanKey } from '../../../lib/stripe/client';

export interface SignUpState {
  error?: string;
  // Present only when Stripe is configured and the company/user were
  // created successfully but still need a card on file — the client
  // switches to <PaymentStep> (payment-step.tsx) to collect it via this
  // SetupIntent, rather than the server redirecting straight to /dashboard.
  clientSecret?: string;
}

export async function signUp(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const companyName = String(formData.get('companyName') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const planRaw = String(formData.get('plan') ?? 'basico');

  if (!companyName || !name || !email || !password) {
    return { error: 'Preenche todos os campos.' };
  }
  if (password.length < 8) {
    return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  }

  const stripeEnabled = isStripeConfigured();
  const plan: PlanKey = isPlanKey(planRaw) ? planRaw : 'basico';

  const slug = await generateUniqueSlug(companyName);
  const company = await prisma.company.create({
    data: { name: companyName, slug, plan: stripeEnabled ? plan : 'starter', status: 'active' },
  });

  try {
    await auth.api.signUpEmail({
      body: { email, password, name, companyId: company.id, role: 'admin' },
      headers: await headers(),
    });
  } catch (err) {
    // Roll back the just-created company so a failed signup (e.g. email
    // already registered) doesn't leave an orphaned, user-less company row.
    await prisma.company.delete({ where: { id: company.id } });
    const message = err instanceof Error ? err.message : 'Não foi possível criar a conta.';
    return { error: message };
  }

  await createDefaultFaqs(company.id);

  // No Stripe key configured — same behavior as before this feature existed,
  // which is also what keeps local dev working without a Stripe account.
  if (!stripeEnabled) {
    redirect('/dashboard');
  }

  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    // Key is set but the Price id for this specific plan isn't — a config
    // gap, not something the customer did wrong. The account itself is
    // already created and usable; just skip billing setup rather than
    // block someone who already successfully signed up.
    console.error(`[stripe] price id ausente para o plano "${plan}" (empresa ${company.id} criada sem assinatura)`);
    redirect('/dashboard');
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: companyName,
    metadata: { companyId: company.id },
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
    where: { id: company.id },
    data: {
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
  });

  const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null;
  if (!setupIntent?.client_secret) {
    // Shouldn't happen given trial_period_days + default_incomplete above,
    // but the account already exists either way — the webhook picks up the
    // real subscription status later regardless of what happens here.
    redirect('/dashboard');
  }

  return { clientSecret: setupIntent.client_secret };
}
