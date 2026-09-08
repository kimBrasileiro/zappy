'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations('dashboard.nav');

  const links = [
    { href: '/dashboard', label: t('home') },
    { href: '/dashboard/inbox', label: t('inbox') },
    { href: '/dashboard/conversations', label: t('conversations') },
    { href: '/dashboard/faq', label: t('faq') },
    { href: '/dashboard/quick-replies', label: t('quickReplies') },
    { href: '/dashboard/services', label: t('services') },
    { href: '/dashboard/bookings', label: t('bookings') },
    { href: '/dashboard/clients', label: t('clients') },
    { href: '/dashboard/reports', label: t('reports') },
    { href: '/dashboard/leads', label: t('leads') },
    { href: '/dashboard/instalacao', label: t('installation') },
    { href: '/dashboard/integracoes', label: t('integrations') },
    { href: '/dashboard/billing', label: t('billing') },
    { href: '/dashboard/suporte', label: t('support') },
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
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
