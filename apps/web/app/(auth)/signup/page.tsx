'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signUp, type SignUpState } from './actions';
import { authClient } from '../../../lib/auth-client';
import { authStyles as s } from '../auth-styles';
import { PaymentStep } from '../../../lib/stripe/payment-step';
import { PLANS, stripeConfiguredOnClient } from '../../../lib/stripe/plans';

const initialState: SignUpState = {};

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

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
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  async function handleGoogle() {
    setGoogleError(null);
    setGooglePending(true);
    // Same button either creates a brand-new User (no companyId yet — lands
    // on /onboarding to create the company, see dashboard/layout.tsx's
    // requireSession redirect) or logs an existing one straight into
    // /dashboard — Google itself doesn't distinguish sign-up from sign-in,
    // so neither does this. On success this navigates away to Google's
    // consent screen; handleGoogle only finishes running if something went
    // wrong before that redirect happened.
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
    if (signInError) {
      setGoogleError(signInError.message ?? 'Não foi possível continuar com o Google. Tenta de novo.');
      setGooglePending(false);
    }
  }

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

        <div style={s.divider}>ou</div>

        {googleError && <div style={s.error}>{googleError}</div>}

        <button type="button" onClick={handleGoogle} disabled={googlePending} style={s.googleButton}>
          {GOOGLE_ICON}
          {googlePending ? 'Redirecionando...' : 'Cadastrar com Google'}
        </button>

        <p style={s.footerText}>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
