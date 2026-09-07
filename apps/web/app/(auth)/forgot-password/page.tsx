'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { authClient } from '../../../lib/auth-client';
import { authStyles as s } from '../auth-styles';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [pending, setPending] = useState(false);
  // Always shown on submit, whether or not the email is actually registered
  // — matches better-auth's own server-side anti-enumeration behavior
  // (request-password-reset returns the same {status:true} either way), so
  // this page never leaks whether an address has an account.
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <main style={s.main}>
        <div style={s.card}>
          <h1 style={s.title}>{t('forgotPasswordSentTitle')}</h1>
          <p style={s.subtitle}>{t('forgotPasswordSentBody')}</p>
          <p style={s.footerText}>
            <Link href="/login">{t('backToLoginLink')}</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={s.main}>
      <form onSubmit={handleSubmit} style={s.card}>
        <h1 style={s.title}>{t('forgotPasswordTitle')}</h1>
        <p style={s.subtitle}>{t('forgotPasswordBody')}</p>

        <label style={s.label}>
          {t('emailLabel')}
          <input name="email" type="email" required style={s.input} />
        </label>

        <button type="submit" disabled={pending} style={s.button}>
          {pending ? t('forgotPasswordSending') : t('forgotPasswordSubmit')}
        </button>

        <p style={s.footerText}>
          <Link href="/login">{t('backToLoginLink')}</Link>
        </p>
      </form>
    </main>
  );
}
