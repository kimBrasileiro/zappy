'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authClient } from '../../lib/auth-client';

export function SignOutButton() {
  const t = useTranslations('dashboard.common');
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="dash-nav-link" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
      {t('signOut')}
    </button>
  );
}
