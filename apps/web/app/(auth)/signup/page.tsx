'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signUp, type SignUpState } from './actions';
import { authStyles as s } from '../auth-styles';
import { PaymentStep } from '../../../lib/stripe/payment-step';
import { PLANS, stripeConfiguredOnClient } from '../../../lib/stripe/plans';

const initialState: SignUpState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={s.button}>
      {pending ? 'Criando conta...' : 'Criar conta'}
    </button>
  );
}

export default function SignUpPage() {
  const [state, formAction] = useFormState(signUp, initialState);

  if (state?.clientSecret) {
    return (
      <main style={s.main}>
        <div style={s.card}>
          <h1 style={s.title}>Só mais um passo</h1>
          <p style={s.subtitle}>7 dias grátis — seu cartão só é cobrado quando o trial acabar.</p>
          <PaymentStep clientSecret={state.clientSecret} />
        </div>
      </main>
    );
  }

  return (
    <main style={s.main}>
      <form action={formAction} style={s.card}>
        <h1 style={s.title}>Criar sua conta</h1>
        <p style={s.subtitle}>Isso cria a sua empresa e o seu usuário administrador.</p>

        {state?.error && <div style={s.error}>{state.error}</div>}

        <label style={s.label}>
          Nome da empresa
          <input name="companyName" required style={s.input} placeholder="Acme Corp" />
        </label>
        <label style={s.label}>
          Seu nome
          <input name="name" required style={s.input} placeholder="Maria Silva" />
        </label>
        <label style={s.label}>
          Email
          <input name="email" type="email" required style={s.input} placeholder="voce@empresa.com" />
        </label>
        <label style={s.label}>
          Senha
          <input name="password" type="password" required minLength={8} style={s.input} />
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

        <p style={s.footerText}>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
