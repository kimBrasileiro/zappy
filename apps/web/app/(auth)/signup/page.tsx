'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signUp, type SignUpState } from './actions';
import { authStyles as s } from '../auth-styles';
import { PaymentStep } from './payment-step';

const initialState: SignUpState = {};

// Matches marketing-home.tsx#PRICING — kept as separate hardcoded copy here
// the same way the rest of this codebase's pricing displays already are
// (no shared source of truth for pricing text yet).
const PLANS = [
  { key: 'basico', label: 'Básico', price: 'R$ 197/mês' },
  { key: 'whatsapp_proprio', label: 'WhatsApp próprio', price: 'R$ 397/mês' },
  { key: 'integracao', label: 'Integração com seu sistema', price: 'R$ 997/mês' },
];

// Only a proxy for "Stripe is configured" (real check is server-side, see
// lib/stripe/client.ts#isStripeConfigured) — but it's what decides whether
// the plan selector renders at all, so that without Stripe set up, signup
// looks and behaves exactly like it did before this feature existed.
const stripeConfiguredOnClient = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

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
