import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireSuperAdmin } from '../../lib/admin-auth';
import '../dashboard/dashboard.css';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin(); // redirects to /login or /dashboard when not authorized
  const t = await getTranslations('admin.nav');

  return (
    <div className="dash-shell">
      <nav className="dash-nav">
        <div className="dash-nav-brand">Zappigo · Admin</div>
        <Link className="dash-nav-link" href="/admin/companies">
          {t('companies')}
        </Link>
        <Link className="dash-nav-link" href="/admin/users">
          {t('users')}
        </Link>
        <Link className="dash-nav-link" href="/admin/usage">
          {t('usage')}
        </Link>
        <Link className="dash-nav-link" href="/admin/health">
          {t('health')}
        </Link>
        <div className="dash-nav-spacer" />
        <Link className="dash-nav-link" href="/dashboard">
          {t('backToDashboard')}
        </Link>
      </nav>
      <main className="dash-main">{children}</main>
    </div>
  );
}
