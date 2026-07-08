'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '../../../lib/auth-client';
import { authStyles as s } from '../auth-styles';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    const { error: signInError } = await authClient.signIn.email({ email, password });
    setPending(false);

    if (signInError) {
      setError(signInError.message ?? 'Email ou senha inválidos.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleGoogle() {
    await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
  }

  return (
    <main style={s.main}>
      <form onSubmit={handleSubmit} style={s.card}>
        <h1 style={s.title}>Entrar</h1>

        {error && <div style={s.error}>{error}</div>}

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

        <button type="button" onClick={handleGoogle} style={s.googleButton}>
          Entrar com Google
        </button>

        <p style={s.footerText}>
          Não tem conta? <Link href="/signup">Criar conta</Link>
        </p>
      </form>
    </main>
  );
}
