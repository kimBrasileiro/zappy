import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';

// Platform-wide access, deliberately not the company-scoped `role` field
// (admin|agent|viewer) — that's a different authorization boundary. Read
// from the environment (every self-hosted deployment sets its own operator
// email — see .env.example) rather than a literal, so forking this repo
// never silently grants someone else's account admin rights over your
// instance. Exported (not just the isSuperAdminEmail check below) because
// lib/notifications.ts also uses it directly as the recipient for
// platform-operator copies of billing events and the dashboard contact form
// — same single source of truth, not a second hardcoded literal.
export const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || '';

// Deliberately a plain string match against the hardcoded constant above —
// never derived from a DB role/flag. A company-impersonation capability
// (see auth-server.ts, dashboard/impersonate-actions.ts) must not become
// grantable to anyone by tampering with a database row.
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

// Cookie holding the company id a super admin is currently impersonating in
// /dashboard. HttpOnly — only ever read/written server-side (auth-server.ts,
// impersonate-actions.ts), never by client JS.
export const IMPERSONATE_COOKIE = 'zappigo_impersonate_company';

export interface RequireSuperAdminResult {
  userId: string;
  email: string;
}

export async function requireSuperAdmin(): Promise<RequireSuperAdminResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  const user = session.user as typeof session.user & { status: string };
  if (user.status !== 'active') {
    redirect('/login');
  }
  if (!isSuperAdminEmail(user.email)) {
    redirect('/dashboard');
  }

  return { userId: user.id, email: user.email };
}
