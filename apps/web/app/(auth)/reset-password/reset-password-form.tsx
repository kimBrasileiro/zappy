'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authClient } from '../../../lib/auth-client';
import { validatePassword } from '../../../lib/password';
import { authStyles as s } from '../auth-styles';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    // Same character-class/blocklist floor as signup (lib/password.ts) — the
    // email argument is blank here since the reset token doesn't carry one
    // back to this page; only that one "matches your own email" check is
    // skipped, not the rest.
    const passwordError = validatePassword(password, '', {
      tooShort: t('passwordTooShort'),
      needsLetterAndNumber: t('passwordNeedsLetterAndNumber'),
      tooCommon: t('passwordTooCommon'),
    });
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setPending(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);

    if (resetError) {
      setError(resetError.message ?? t('resetPasswordError'));
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <main style={s.main}>
        <div style={s.card}>
          <h1 style={s.title}>{t('resetPasswordInvalidTitle')}</h1>
          <p style={s.subtitle}>{t('resetPasswordInvalidBody')}</p>
          <Link href="/forgot-password" style={{ ...s.button, display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
            {t('resetPasswordRequestNewLink')}
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main style={s.main}>
        <div style={s.card}>
          <h1 style={s.title}>{t('resetPasswordDoneTitle')}</h1>
          <p style={s.subtitle}>{t('resetPasswordDoneBody')}</p>
          <button type="button" onClick={() => router.push('/login')} style={s.button}>
            {t('backToLoginLink')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={s.main}>
      <form onSubmit={handleSubmit} style={s.card}>
        <h1 style={s.title}>{t('resetPasswordTitle')}</h1>

        {error && <div style={s.error}>{error}</div>}

        <label style={s.label}>
          {t('resetPasswordNewLabel')}
          <input name="password" type="password" required minLength={10} style={s.input} />
          <span style={{ fontSize: 11.5, color: '#999', fontWeight: 400 }}>{t('passwordHint')}</span>
        </label>

        <button type="submit" disabled={pending} style={s.button}>
          {pending ? t('resetPasswordSaving') : t('resetPasswordSubmit')}
        </button>
      </form>
    </main>
  );
}
