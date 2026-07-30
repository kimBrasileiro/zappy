import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../lib/auth-server';
import { SignOutButton } from './sign-out-button';
import { CompanySwitcher } from './company-switcher';
import { NavLinks } from './nav-links';
import { LocaleSwitcher } from '../locale-switcher';
import { stopImpersonating } from './impersonate-actions';
import './dashboard.css';

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { companyId, isSuperAdmin, actualCompanyId } = await requireSession(); // redirects to /login or /onboarding when needed
  const t = await getTranslations('dashboard.impersonation');

  const isImpersonating = isSuperAdmin && companyId !== actualCompanyId;
  const companies = isSuperAdmin
    ? await prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } })
    : [];
  const impersonatedCompany = isImpersonating
    ? await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    : null;

  return (
    <div className="dash-shell">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <span className="dash-nav-logo" dangerouslySetInnerHTML={{ __html: ICON_CHAT }} />
          Zappigo
        </div>
        {isSuperAdmin && <CompanySwitcher companies={companies} currentCompanyId={companyId} />}
        <div style={{ padding: '0 8px 10px' }}>
          <LocaleSwitcher />
        </div>
        {isImpersonating && (
          <div
            style={{
              margin: '0 8px 10px',
              padding: '8px 10px',
              background: '#78350f',
              color: '#fde68a',
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.5,
            }}
          >
            {t.rich('viewingAs', { name: impersonatedCompany?.name ?? '', b: (chunks) => <strong>{chunks}</strong> })}
            <form action={stopImpersonating}>
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fde68a',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 11.5,
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {t('backToMyCompany')}
              </button>
            </form>
          </div>
        )}
        <NavLinks />
        <div className="dash-nav-spacer" />
        <SignOutButton />
      </nav>
      <main className="dash-main">{children}</main>
    </div>
  );
}
