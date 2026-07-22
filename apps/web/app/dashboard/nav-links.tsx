'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Início' },
  { href: '/dashboard/inbox', label: 'Inbox' },
  { href: '/dashboard/conversations', label: 'Conversas' },
  { href: '/dashboard/faq', label: 'FAQ' },
  { href: '/dashboard/quick-replies', label: 'Quick Replies' },
  { href: '/dashboard/services', label: 'Serviços' },
  { href: '/dashboard/bookings', label: 'Agendamentos' },
  { href: '/dashboard/instalacao', label: 'Instalação' },
  { href: '/dashboard/billing', label: 'Assinatura' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
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
