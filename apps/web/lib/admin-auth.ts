import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';

// Platform-wide access, deliberately not the company-scoped `role` field
// (admin|agent|viewer) — that's a different authorization boundary. Fixed
// to this one email as requested; isolated here so it's easy to find/change.
const SUPER_ADMIN_EMAIL = 'kim@wisell.ai';

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
export const IMPERSONATE_COOKIE = 'zappy_impersonate_company';

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
