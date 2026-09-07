'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { completeOnboarding, type OnboardingState } from './actions';
import { authStyles as s } from '../(auth)/auth-styles';
import { PaymentStep } from '../../lib/stripe/payment-step';
import { PLANS, stripeConfiguredOnClient } from '../../lib/stripe/plans';
import { BUSINESS_TYPES } from '../../lib/business-types';

const initialState: OnboardingState = {};

function SubmitButton() {
  const t = useTranslations('auth');
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={s.button}>
      {pending ? t('onboardingCreating') : t('onboardingContinue')}
    </button>
  );
}

export function OnboardingForm() {
  const t = useTranslations('auth');
  const tb = useTranslations('dashboard.billing');
  const [state, formAction] = useFormState(completeOnboarding, initialState);

  const planLabels: Record<string, string> = {
    basico: tb('planBasico'),
  };
  const businessTypeLabels: Record<string, string> = {
    salao_beleza: t('businessTypeSalaoBeleza'),
    barbearia: t('businessTypeBarbearia'),
    pet_shop: t('businessTypePetShop'),
    estetica_massagem: t('businessTypeEsteticaMassagem'),
    outro: t('businessTypeOutro'),
  };

  if (state?.clientSecret) {
    return (
      <div style={s.card}>
        <h1 style={s.title}>{t('oneMoreStepTitle')}</h1>
        <p style={s.subtitle}>{t('trialSubtitle')}</p>
        <PaymentStep clientSecret={state.clientSecret} />
      </div>
    );
  }

  return (
    <form action={formAction} style={s.card}>
      <h1 style={s.title}>{t('onboardingTitle')}</h1>
      <p style={s.subtitle}>{t('onboardingSubtitle')}</p>

      {state?.error && <div style={s.error}>{state.error}</div>}

      <label style={s.label}>
        {t('companyNameLabel')}
        <input name="companyName" required style={s.input} placeholder={t('companyNamePlaceholder')} />
      </label>

      <label style={s.label}>
        {t('businessTypeLabel')}
        <select name="businessType" required defaultValue="" style={s.input}>
          <option value="" disabled>
            {t('businessTypePlaceholder')}
          </option>
          {BUSINESS_TYPES.map((key) => (
            <option key={key} value={key}>
              {businessTypeLabels[key]}
            </option>
          ))}
        </select>
      </label>

      {stripeConfiguredOnClient && (
        <div style={s.label}>
          {t('planSectionLabel')}
          <input type="hidden" name="plan" value={PLANS[0].key} />
          <p style={{ fontWeight: 400, margin: '4px 0 0', fontSize: 14 }}>
            {planLabels[PLANS[0].key] ?? PLANS[0].label} — {PLANS[0].price}
            {tb('perMonthSuffix')}
          </p>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#555' }}>
        <input type="checkbox" name="terms" required style={{ marginTop: 2 }} />
        <span>
          {t('termsPrefix')}{' '}
          <Link href="/terms" target="_blank" style={{ color: '#2563eb' }}>
            {t('termsLink')}
          </Link>{' '}
          {t('andConnector')}{' '}
          <Link href="/privacy" target="_blank" style={{ color: '#2563eb' }}>
            {t('privacyLink')}
          </Link>
          .
        </span>
      </label>

      <SubmitButton />
    </form>
  );
}
