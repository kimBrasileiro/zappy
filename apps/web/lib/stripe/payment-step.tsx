'use client';

import { useState, type FormEvent } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { authStyles as s } from '../../app/(auth)/auth-styles';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function ConfirmCardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    // No charge happens here — this is a SetupIntent (see signup/actions.ts
    // and onboarding/actions.ts), it only attaches a payment method to the
    // subscription for when the 7-day trial ends. On success Stripe redirects
    // to return_url itself; we only ever see this function return when it
    // *didn't* succeed.
    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard` },
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Não foi possível confirmar o cartão.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <div style={s.error}>{error}</div>}
      <PaymentElement />
      <button type="submit" disabled={!stripe || submitting} style={s.button}>
        {submitting ? 'Confirmando...' : 'Confirmar e começar o trial de 7 dias'}
      </button>
    </form>
  );
}

export function PaymentStep({ clientSecret }: { clientSecret: string }) {
  if (!stripePromise) {
    return (
      <div style={s.error}>
        Stripe não está configurado corretamente (chave pública ausente) — fale com o suporte.
      </div>
    );
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <ConfirmCardForm />
    </Elements>
  );
}
