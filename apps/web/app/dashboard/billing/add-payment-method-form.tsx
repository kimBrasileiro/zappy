'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { addPaymentMethod } from './actions';
import { PaymentStep } from '../../../lib/stripe/payment-step';

export function AddPaymentMethodForm() {
  const t = useTranslations('dashboard.billing');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await addPaymentMethod();
    setPending(false);
    if (result.error) setError(result.error);
    else if (result.clientSecret) setClientSecret(result.clientSecret);
  }

  if (clientSecret) {
    return <PaymentStep clientSecret={clientSecret} returnPath="/dashboard/billing" />;
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 10,
      }}
    >
      <p style={{ color: '#92400e', fontSize: 13, margin: '0 0 10px' }}>{t('noPaymentMethodWarning')}</p>
      {error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button type="button" onClick={handleClick} disabled={pending} className="dash-btn">
        {pending ? t('startingSubscription') : t('addPaymentMethodButton')}
      </button>
    </div>
  );
}
