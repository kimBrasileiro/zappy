'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard/inbox', label: 'Inbox' },
  { href: '/dashboard/conversations', label: 'Conversas' },
  { href: '/dashboard/knowledge-base', label: 'Base de Conhecimento' },
  { href: '/dashboard/faq', label: 'FAQ' },
  { href: '/dashboard/quick-replies', label: 'Quick Replies' },
  { href: '/dashboard/services', label: 'Serviços' },
  { href: '/dashboard/bookings', label: 'Agendamentos' },
  { href: '/dashboard/instalacao', label: 'Instalação' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
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
