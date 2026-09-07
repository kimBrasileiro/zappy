'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { startSubscription } from './actions';
import { PaymentStep } from '../../../lib/stripe/payment-step';

export function StartSubscriptionForm({ planLabel, price }: { planLabel: string; price: string }) {
  const t = useTranslations('dashboard.billing');
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleStart() {
    setPending(true);
    setError(null);
    const result = await startSubscription();
    setPending(false);
    if (result.error) {
      setError(result.error);
    } else if (result.clientSecret) {
      setClientSecret(result.clientSecret);
    } else if (result.success) {
      // A subscription already exists (trial started with no card step to
      // show) — reload this Server Component so it renders the normal
      // active-subscription view instead of staying on this form.
      router.refresh();
    }
  }

  if (clientSecret) {
    return <PaymentStep clientSecret={clientSecret} />;
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>
        {planLabel} — {price}
        {t('perMonthSuffix')}
      </p>
      <p style={{ color: '#666', fontSize: 13, margin: '0 0 16px' }}>{t('trialFootnote')}</p>
      {error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button type="button" onClick={handleStart} disabled={pending} className="dash-btn">
        {pending ? t('startingSubscription') : t('startSubscriptionButton')}
      </button>
    </div>
  );
}
