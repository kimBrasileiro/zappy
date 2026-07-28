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

  if (state?.needsVerification) {
    return (
      <main style={s.main}>
        <div style={s.card}>
          <h1 style={s.title}>Confirme seu email</h1>
          <p style={s.subtitle}>
            Sua conta foi criada. Mandamos um link de confirmação pro seu email — clica nele pra
            acessar o dashboard.
          </p>
        </div>
      </main>
    );
  }

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
          Telefone <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span>
          <input name="phone" type="tel" style={s.input} placeholder="11 98765-4321" />
        </label>
        <label style={s.label}>
          Senha
          <input name="password" type="password" required minLength={10} style={s.input} />
          <span style={{ fontSize: 11.5, color: '#999', fontWeight: 400 }}>
            Mínimo de 10 caracteres, com pelo menos uma letra e um número.
          </span>
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

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#555' }}>
          <input type="checkbox" name="terms" required style={{ marginTop: 2 }} />
          <span>
            Li e concordo com os{' '}
            <Link href="/terms" target="_blank" style={{ color: '#2563eb' }}>
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link href="/privacy" target="_blank" style={{ color: '#2563eb' }}>
              Política de Privacidade
            </Link>
            .
          </span>
        </label>

        <SubmitButton />

        <p style={s.footerText}>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
