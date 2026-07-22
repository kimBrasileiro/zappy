'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { completeOnboarding, type OnboardingState } from './actions';
import { authStyles as s } from '../(auth)/auth-styles';
import { PaymentStep } from '../../lib/stripe/payment-step';
import { PLANS, stripeConfiguredOnClient } from '../../lib/stripe/plans';

const initialState: OnboardingState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={s.button}>
      {pending ? 'Criando...' : 'Continuar'}
    </button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useFormState(completeOnboarding, initialState);

  if (state?.clientSecret) {
    return (
      <div style={s.card}>
        <h1 style={s.title}>Só mais um passo</h1>
        <p style={s.subtitle}>7 dias grátis — seu cartão só é cobrado quando o trial acabar.</p>
        <PaymentStep clientSecret={state.clientSecret} />
      </div>
    );
  }

  return (
    <form action={formAction} style={s.card}>
      <h1 style={s.title}>Quase lá!</h1>
      <p style={s.subtitle}>Qual o nome da sua empresa?</p>

      {state?.error && <div style={s.error}>{state.error}</div>}

      <label style={s.label}>
        Nome da empresa
        <input name="companyName" required style={s.input} placeholder="Acme Corp" />
      </label>

      {stripeConfiguredOnClient && (
        <div style={s.label}>
          Plano (7 dias grátis)
          {PLANS.map((p, i) => (
            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
              <input type="radio" name="plan" value={p.key} defaultChecked={i === 0} />
              {p.label} — {p.price}
            </label>
          ))}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
