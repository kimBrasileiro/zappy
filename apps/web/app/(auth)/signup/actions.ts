'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@zappy/db';
import { auth } from '../../../lib/auth';
import { generateUniqueSlug } from '../../../lib/slug';
import { createDefaultFaqs } from '../../../lib/default-faqs';
import { isPlanKey, isStripeConfigured, startTrialSubscription, type PlanKey } from '../../../lib/stripe/client';
import { TERMS_VERSION } from '../../../lib/legal';
import { validatePassword } from '../../../lib/password';

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
  const acceptedTerms = formData.get('terms') === 'on';

  if (!companyName || !name || !email || !password) {
    return { error: 'Preenche todos os campos.' };
  }
  const passwordError = validatePassword(password, email);
  if (passwordError) {
    return { error: passwordError };
  }
  if (!acceptedTerms) {
    return { error: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade pra continuar.' };
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
  await prisma.user.update({
    where: { email },
    data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
  });

  // No Stripe key configured — same behavior as before this feature existed,
  // which is also what keeps local dev working without a Stripe account.
  if (!stripeEnabled) {
    redirect('/dashboard');
  }

  const clientSecret = await startTrialSubscription({
    companyId: company.id,
    companyName,
    email,
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
