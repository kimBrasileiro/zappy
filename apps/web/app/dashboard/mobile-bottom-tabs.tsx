'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

// A native-app-style bottom tab bar, shown only under the mobile breakpoint
// (see dashboard.css .dash-bottom-tabs — display:none until then). The full
// 14-item link list (nav-links.tsx) doesn't fit five-wide, so this is a
// deliberately short subset of the things used most day-to-day; everything
// else (including these same four) stays reachable via "Mais", which opens
// the same off-canvas drawer as the desktop sidebar (dash-nav-toggle
// checkbox in layout.tsx) rather than duplicating the full menu here.
const ICON_HOME = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_INBOX = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_USERS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="9" r="2.3" stroke="currentColor" stroke-width="2"/><path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_MENU = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

export function MobileBottomTabs({ modality = 'appointments' }: { modality?: string }) {
  const pathname = usePathname();
  const t = useTranslations('dashboard.nav');

  const tabs = [
    { href: '/dashboard', label: t('home'), icon: ICON_HOME },
    modality === 'sports_classes'
      ? { href: '/dashboard/agenda-quadras', label: t('courtAgenda'), icon: ICON_CALENDAR }
      : { href: '/dashboard/bookings', label: t('bookings'), icon: ICON_CALENDAR },
    { href: '/dashboard/inbox', label: t('inbox'), icon: ICON_INBOX },
    { href: '/dashboard/clients', label: t('clients'), icon: ICON_USERS },
  ];

  return (
    <nav className="dash-bottom-tabs" aria-label={t('home')}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={`dash-bottom-tab${isActive ? ' active' : ''}`}>
            <span className="dash-bottom-tab-icon" dangerouslySetInnerHTML={{ __html: tab.icon }} />
            <span className="dash-bottom-tab-label">{tab.label}</span>
          </Link>
        );
      })}
      <label htmlFor="dash-nav-toggle" className="dash-bottom-tab dash-bottom-tab-more">
        <span className="dash-bottom-tab-icon" dangerouslySetInnerHTML={{ __html: ICON_MENU }} />
        <span className="dash-bottom-tab-label">{t('more')}</span>
      </label>
    </nav>
  );
}
