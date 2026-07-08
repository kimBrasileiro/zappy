'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signUp, type SignUpState } from './actions';
import { authStyles as s } from '../auth-styles';

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

        <SubmitButton />

        <p style={s.footerText}>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
