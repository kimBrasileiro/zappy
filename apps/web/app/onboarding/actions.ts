'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@zappy/db';
import { auth } from '../../lib/auth';
import { generateUniqueSlug } from '../../lib/slug';
import { createDefaultFaqs } from '../../lib/default-faqs';
import { isPlanKey, isStripeConfigured, startTrialSubscription, type PlanKey } from '../../lib/stripe/client';

export interface OnboardingState {
  error?: string;
  // Present only when Stripe is configured and the company was created
  // successfully but still needs a card on file — same handoff as
  // signup/actions.ts#SignUpState, so a Google sign-in doesn't skip billing
  // just because it didn't go through the email/password form.
  clientSecret?: string;
}

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const companyName = String(formData.get('companyName') ?? '').trim();
  if (!companyName) {
    return { error: 'Digite o nome da sua empresa.' };
  }

  const stripeEnabled = isStripeConfigured();
  const planRaw = String(formData.get('plan') ?? 'basico');
  const plan: PlanKey = isPlanKey(planRaw) ? planRaw : 'basico';

  const slug = await generateUniqueSlug(companyName);
  const company = await prisma.company.create({
    data: { name: companyName, slug, plan: stripeEnabled ? plan : 'starter', status: 'active' },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { companyId: company.id, role: 'admin' },
  });

  await createDefaultFaqs(company.id);

  // No Stripe key configured — same behavior as before this feature existed,
  // which is also what keeps local dev working without a Stripe account.
  if (!stripeEnabled) {
    redirect('/dashboard');
  }

  const clientSecret = await startTrialSubscription({
    companyId: company.id,
    companyName,
    email: session.user.email,
    plan,
  });

  // The account itself is already created and usable either way — a missing
  // price id or setup intent just means there's nothing further to collect
  // right now, not something the customer did wrong.
  if (!clientSecret) {
    redirect('/dashboard');
  }

  return { clientSecret };
}
