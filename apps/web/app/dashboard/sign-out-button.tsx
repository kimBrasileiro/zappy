'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authClient } from '../../lib/auth-client';

const ICON_SIGN_OUT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function SignOutButton() {
  const t = useTranslations('dashboard.common');
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="dash-nav-link" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
      <span className="dash-nav-link-icon" dangerouslySetInnerHTML={{ __html: ICON_SIGN_OUT }} />
      {t('signOut')}
    </button>
  );
}
