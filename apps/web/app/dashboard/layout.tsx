import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../lib/auth-server';
import { SignOutButton } from './sign-out-button';
import { CompanySwitcher } from './company-switcher';
import { NavLinks } from './nav-links';
import { MobileBottomTabs } from './mobile-bottom-tabs';
import { LocaleSwitcher } from '../locale-switcher';
import { stopImpersonating } from './impersonate-actions';
import { getModality } from '../../lib/modality';
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

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { config: true } });
  const modality = getModality(company ?? { config: null });

  return (
    <div className="dash-shell">
      {/* Checkbox-driven off-canvas drawer — no client JS needed for the
          open/close toggle itself (this layout stays a server component).
          Must be the first child so the CSS ~ sibling combinator below
          (dashboard.css) can reach the topbar/backdrop/nav that follow it. */}
      <input type="checkbox" id="dash-nav-toggle" className="dash-nav-toggle-input" />
      <header className="dash-mobile-topbar">
        <label htmlFor="dash-nav-toggle" className="dash-mobile-menu-btn" aria-label="Menu">
          <span style={{ display: 'inline-flex', width: 22, height: 22 }} dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no need for next/image here */}
          <img src="/zappigo-icon.png" alt="" width={24} height={24} style={{ borderRadius: 7 }} />
          Zappigo
        </div>
        <span style={{ width: 22 }} />
      </header>
      <label htmlFor="dash-nav-toggle" className="dash-nav-backdrop" aria-hidden="true" />
      <nav className="dash-nav">
        <label htmlFor="dash-nav-toggle" className="dash-nav-close" aria-label="Fechar menu">
          ✕
        </label>
        <div className="dash-nav-brand" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no need for next/image here */}
            <img src="/zappigo-icon.png" alt="" width={28} height={28} style={{ borderRadius: 9, flexShrink: 0 }} />
            Zappigo
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 400, color: '#6b7280', wordBreak: 'break-all' }}>{email}</span>
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
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
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
                  color: '#92400e',
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
        <NavLinks modality={modality} />
        <div className="dash-nav-spacer" />
        <SignOutButton />
      </nav>
      <main className="dash-main">{children}</main>
      <MobileBottomTabs modality={modality} />
    </div>
  );
}
