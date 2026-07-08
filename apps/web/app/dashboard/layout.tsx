import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireSession } from '../../lib/auth-server';
import { SignOutButton } from './sign-out-button';
import './dashboard.css';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireSession(); // redirects to /login or /onboarding when needed

  return (
    <div className="dash-shell">
      <nav className="dash-nav">
        <div className="dash-nav-brand">Chat IA</div>
        <Link className="dash-nav-link" href="/dashboard/conversations">
          Conversas
        </Link>
        <Link className="dash-nav-link" href="/dashboard/knowledge-base">
          Base de Conhecimento
        </Link>
        <Link className="dash-nav-link" href="/dashboard/faq">
          FAQ
        </Link>
        <Link className="dash-nav-link" href="/dashboard/quick-replies">
          Quick Replies
        </Link>
        <Link className="dash-nav-link" href="/dashboard/services">
          Serviços
        </Link>
        <Link className="dash-nav-link" href="/dashboard/bookings">
          Agendamentos
        </Link>
        <div className="dash-nav-spacer" />
        <SignOutButton />
      </nav>
      <main className="dash-main">{children}</main>
    </div>
  );
}
