'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

// One small line icon per nav item, same treatment as the marketing page's
// own ICON_* consts — self-contained per file in this codebase rather than
// a shared icon module (see marketing-home.tsx, mobile-bottom-tabs.tsx).
const ICON_HOME = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_INBOX = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const ICON_CONVERSATIONS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 11h10a2 2 0 0 1 2 2v5l-4-2H9a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_FAQ = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`;
const ICON_QUICK_REPLIES = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_SERVICES = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 11.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>`;
const ICON_BOOKINGS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_CLIENTS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17" cy="9" r="2.3" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_REPORTS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20V11M10 20V4M16 20v-6M4 20h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_LEADS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 10v4h4l6 4V6l-6 4H3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17.5 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_INSTALLATION = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m8 6-6 6 6 6M16 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_INTEGRATIONS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 15 15 9M10.5 5.5l1-1a3.5 3.5 0 0 1 5 5l-1 1M13.5 18.5l-1 1a3.5 3.5 0 0 1-5-5l1-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_BILLING = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="5.5" width="19" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 10h19" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_SUPPORT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="2" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="17" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M19 20v1a2 2 0 0 1-2 2h-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

const ICON_COURT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M12 5v14M3 12h18" stroke="currentColor" stroke-width="1.8"/></svg>`;

export function NavLinks({ modality = 'appointments' }: { modality?: string }) {
  const pathname = usePathname();
  const t = useTranslations('dashboard.nav');

  const links = [
    { href: '/dashboard', label: t('home'), icon: ICON_HOME },
    { href: '/dashboard/inbox', label: t('inbox'), icon: ICON_INBOX },
    { href: '/dashboard/conversations', label: t('conversations'), icon: ICON_CONVERSATIONS },
    { href: '/dashboard/faq', label: t('faq'), icon: ICON_FAQ },
    { href: '/dashboard/quick-replies', label: t('quickReplies'), icon: ICON_QUICK_REPLIES },
    ...(modality === 'sports_classes'
      ? [
          { href: '/dashboard/agenda-quadras', label: t('courtAgenda'), icon: ICON_BOOKINGS },
          { href: '/dashboard/turmas', label: t('classGrid'), icon: ICON_SERVICES },
          { href: '/dashboard/quadras', label: t('courts'), icon: ICON_COURT },
          { href: '/dashboard/clients', label: t('students'), icon: ICON_CLIENTS },
        ]
      : [
          { href: '/dashboard/services', label: t('services'), icon: ICON_SERVICES },
          { href: '/dashboard/bookings', label: t('bookings'), icon: ICON_BOOKINGS },
          { href: '/dashboard/clients', label: t('clients'), icon: ICON_CLIENTS },
          { href: '/dashboard/reports', label: t('reports'), icon: ICON_REPORTS },
        ]),
    { href: '/dashboard/leads', label: t('leads'), icon: ICON_LEADS },
    { href: '/dashboard/instalacao', label: t('installation'), icon: ICON_INSTALLATION },
    { href: '/dashboard/integracoes', label: t('integrations'), icon: ICON_INTEGRATIONS },
    { href: '/dashboard/billing', label: t('billing'), icon: ICON_BILLING },
    { href: '/dashboard/suporte', label: t('support'), icon: ICON_SUPPORT },
  ];

  return (
    <>
      {links.map((link) => {
        // '/dashboard' itself must be an exact match — otherwise its
        // startsWith(`${href}/`) check would match every other dashboard
        // route too (they all start with "/dashboard/").
        const isActive =
          pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            className={`dash-nav-link${isActive ? ' active' : ''}`}
            href={link.href}
          >
            <span className="dash-nav-link-icon" dangerouslySetInnerHTML={{ __html: link.icon }} />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
