import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireSuperAdmin } from '../../lib/admin-auth';
import '../dashboard/dashboard.css';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin(); // redirects to /login or /dashboard when not authorized

  return (
    <div className="dash-shell">
      <nav className="dash-nav">
        <div className="dash-nav-brand">Chat IA · Admin</div>
        <Link className="dash-nav-link" href="/admin/companies">
          Empresas
        </Link>
        <Link className="dash-nav-link" href="/admin/users">
          Usuários
        </Link>
        <div className="dash-nav-spacer" />
        <Link className="dash-nav-link" href="/dashboard">
          Ir para o Dashboard
        </Link>
      </nav>
      <main className="dash-main">{children}</main>
    </div>
  );
}
