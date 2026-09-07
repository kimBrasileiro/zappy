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

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // allowInactiveBilling: true — this layout wraps /dashboard/billing itself
  // (where a suspended company needs to land to see why and reactivate), so
  // it can't be the thing enforcing the gate; each individual page does that
  // via its own plain requireSession() call instead (see lib/auth-server.ts).
  const { companyId, email, isSuperAdmin, actualCompanyId } = await requireSession({ allowInactiveBilling: true }); // redirects to /login or /onboarding when needed
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
        <div className="dash-nav-brand" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no need for next/image here */}
            <img src="/zappigo-icon.png" alt="" width={28} height={28} style={{ borderRadius: 9, flexShrink: 0 }} />
            Zappigo
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 400, color: '#8b8f9a', wordBreak: 'break-all' }}>{email}</span>
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
