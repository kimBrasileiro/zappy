'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { completeOnboarding, type OnboardingState } from './actions';
import { authStyles as s } from '../(auth)/auth-styles';

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

  return (
    <form action={formAction} style={s.card}>
      <h1 style={s.title}>Quase lá!</h1>
      <p style={s.subtitle}>Qual o nome da sua empresa?</p>

      {state?.error && <div style={s.error}>{state.error}</div>}

      <label style={s.label}>
        Nome da empresa
        <input name="companyName" required style={s.input} placeholder="Acme Corp" />
      </label>

      <SubmitButton />
    </form>
  );
}
