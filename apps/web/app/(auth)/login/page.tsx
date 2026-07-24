'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '../../../lib/auth-client';
import { authStyles as s } from '../auth-styles';

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  // Remembered across the failed attempt specifically so "Reenviar email" has
  // something to resend to — better-auth doesn't require re-typing the email
  // just to trigger this.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setResendState('idle');
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    const { error: signInError } = await authClient.signIn.email({ email, password });
    setPending(false);

    if (signInError) {
      if (signInError.code === 'EMAIL_NOT_VERIFIED') {
        setError('Você precisa confirmar seu email antes de entrar — verifica sua caixa de entrada.');
        setUnverifiedEmail(email);
      } else {
        setError(signInError.message ?? 'Email ou senha inválidos.');
      }
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleResendVerification() {
    if (!unverifiedEmail) return;
    setResendState('sending');
    await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: '/dashboard' });
    setResendState('sent');
  }

  async function handleGoogle() {
    setGoogleError(null);
    setGooglePending(true);
    // On success this navigates the whole page away to Google's consent
    // screen — handleGoogle only ever finishes running (and this component
    // re-renders) if something went wrong before that redirect happened.
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
    if (signInError) {
      setGoogleError(signInError.message ?? 'Não foi possível entrar com o Google. Tenta de novo.');
      setGooglePending(false);
    }
  }

  return (
    <main style={s.main}>
      <form onSubmit={handleSubmit} style={s.card}>
        <h1 style={s.title}>Entrar</h1>

        {error && <div style={s.error}>{error}</div>}
        {unverifiedEmail && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendState !== 'idle'}
            style={{ ...s.googleButton, marginBottom: 12 }}
          >
            {resendState === 'sent'
              ? 'Email reenviado — confira sua caixa de entrada'
              : resendState === 'sending'
                ? 'Reenviando...'
                : 'Reenviar email de confirmação'}
          </button>
        )}

        <label style={s.label}>
          Email
          <input name="email" type="email" required style={s.input} />
        </label>
        <label style={s.label}>
          Senha
          <input name="password" type="password" required style={s.input} />
        </label>

        <button type="submit" disabled={pending} style={s.button}>
          {pending ? 'Entrando...' : 'Entrar'}
        </button>

        <div style={s.divider}>ou</div>

        {googleError && <div style={s.error}>{googleError}</div>}

        <button type="button" onClick={handleGoogle} disabled={googlePending} style={s.googleButton}>
          {GOOGLE_ICON}
          {googlePending ? 'Redirecionando...' : 'Entrar com Google'}
        </button>

        <p style={s.footerText}>
          Não tem conta? <Link href="/signup">Criar conta</Link>
        </p>
      </form>
    </main>
  );
}
