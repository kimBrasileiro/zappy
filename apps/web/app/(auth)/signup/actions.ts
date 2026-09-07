'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { auth } from '../../../lib/auth';
import { generateUniqueSlug, isCompanyNameTaken } from '../../../lib/slug';
import { createDefaultFaqs } from '../../../lib/default-faqs';
import { getDeploymentDefaultLocale } from '../../../i18n/default-locale';
import { isPlanKey, isStripeConfigured, startTrialSubscription, type PlanKey } from '../../../lib/stripe/client';
import { TERMS_VERSION } from '../../../lib/legal';
import { validatePassword } from '../../../lib/password';
import { notifyNewSignup } from '../../../lib/notifications';
import { isBusinessType } from '../../../lib/business-types';

export interface SignUpState {
  error?: string;
  // Present only when Stripe is configured and the company/user were
  // created successfully but still need a card on file — the client
  // switches to <PaymentStep> (payment-step.tsx) to collect it via this
  // SetupIntent, rather than the server redirecting straight to /dashboard.
  clientSecret?: string;
  // Account + company were created, but better-auth (requireEmailVerification
  // in lib/auth.ts) didn't issue a session — no dashboard access until the
  // customer clicks the link in the confirmation email. The client shows a
  // "check your email" message instead of redirecting.
  needsVerification?: boolean;
}

export async function signUp(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const t = await getTranslations('auth');
  const companyName = String(formData.get('companyName') ?? '').trim();
  const businessTypeRaw = String(formData.get('businessType') ?? '');
  const businessType = isBusinessType(businessTypeRaw) ? businessTypeRaw : null;
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const password = String(formData.get('password') ?? '');
  const planRaw = String(formData.get('plan') ?? 'basico');
  const acceptedTerms = formData.get('terms') === 'on';

  if (!companyName || !businessType || !name || !email || !password) {
    return { error: t('errorFillAllFields') };
  }
  const passwordError = validatePassword(password, email, {
    tooShort: t('passwordTooShort'),
    needsLetterAndNumber: t('passwordNeedsLetterAndNumber'),
    tooCommon: t('passwordTooCommon'),
  });
  if (passwordError) {
    return { error: passwordError };
  }
  if (!acceptedTerms) {
    return { error: t('errorMustAcceptTerms') };
  }
  // Two companies sharing a (near-enough) name break the shared WhatsApp
  // number's "just say your business's name" matching — see
  // lib/slug.ts#isCompanyNameTaken.
  if (await isCompanyNameTaken(companyName)) {
    return { error: t('errorCompanyNameTaken') };
  }

  const stripeEnabled = isStripeConfigured();
  const plan: PlanKey = isPlanKey(planRaw) ? planRaw : 'basico';

  const slug = await generateUniqueSlug(companyName);
  const company = await prisma.company.create({
    data: {
      name: companyName,
      slug,
      businessType,
      plan: stripeEnabled ? plan : 'starter',
      status: 'active',
      // This deployment's own default language (see i18n/default-locale.ts)
      // — e.g. a company signing up on a Spanish-default deployment gets a
      // bot that replies in Spanish to its own customers by default,
      // matching the Spanish default FAQs createDefaultFaqs seeds below.
      config: { language: getDeploymentDefaultLocale() },
    },
  });

  let signUpResult: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    signUpResult = await auth.api.signUpEmail({
      // callbackURL: where clicking the confirmation email link lands once
      // verified (see lib/auth.ts's sendVerificationEmail, which builds the
      // emailed link's own `url` from this) — defaults to "/" otherwise,
      // stranding a just-verified customer on the marketing homepage.
      // Landing on billing specifically (not /dashboard) is deliberate: a
      // company on the real paid plan has no Stripe subscription yet at
      // this point, and requireSession's billing gate (lib/auth-server.ts)
      // blocks every OTHER dashboard route until one exists with a real
      // card attached — this is the one page that gate lets through, and
      // the one that actually starts that flow (see start-subscription-form.tsx).
      body: { email, password, name, companyId: company.id, role: 'admin', callbackURL: '/dashboard/billing' },
      headers: await headers(),
    });
  } catch (err) {
    // Roll back the just-created company so a failed signup (e.g. email
    // already registered) doesn't leave an orphaned, user-less company row.
    await prisma.company.delete({ where: { id: company.id } });
    const message = err instanceof Error ? err.message : t('errorAccountCreationFailed');
    return { error: message };
  }

  await createDefaultFaqs(company.id);
  await prisma.user.update({
    where: { email },
    data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION, phone },
  });
  await notifyNewSignup({ companyName, adminEmail: email, plan: company.plan });

  // requireEmailVerification (lib/auth.ts) means signUpEmail didn't issue a
  // session — no token in the response. The account exists and is fully set
  // up, but there's nothing to redirect INTO yet (requireSession would just
  // bounce to /login with no explanation), so this stops here instead and
  // lets the client show a "check your email" message.
  if (!signUpResult.token) {
    return { needsVerification: true };
  }

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
