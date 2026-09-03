import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@zappigo/db';
import { auth } from './auth';
import { IMPERSONATE_COOKIE, isSuperAdminEmail } from './admin-auth';

export interface RequireSessionResult {
  userId: string;
  email: string;
  companyId: string;
  role: string;
  // True only for the hardcoded super-admin email (see admin-auth.ts) —
  // gates the company switcher in dashboard/layout.tsx and the impersonate
  // server actions. isSuperAdmin never changes companyId by itself; that
  // only happens below, via the IMPERSONATE_COOKIE.
  isSuperAdmin: boolean;
  // The signed-in user's own company — same as companyId unless a super
  // admin is currently impersonating a different one.
  actualCompanyId: string;
}

// Every dashboard Server Component/Server Action calls this first — no
// exceptions — so tenant scoping never depends on remembering to add a
// `where: { companyId }` in one specific place.
export async function requireSession(): Promise<RequireSessionResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  const user = session.user as typeof session.user & {
    companyId: string | null;
    role: string;
    status: string;
  };

  // Soft-deleted by an admin (apps/web/app/admin/users/actions.ts) — the
  // session cookie may still be technically valid, but every protected
  // route re-checks this, so a deactivated account can't do anything.
  if (user.status !== 'active') {
    redirect('/login');
  }

  if (!user.companyId) {
    redirect('/onboarding');
  }

  const isSuperAdmin = isSuperAdminEmail(user.email);
  let companyId = user.companyId;

  if (isSuperAdmin) {
    const impersonating = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (impersonating) {
      // A stale/tampered cookie value (deleted company, bad id) silently
      // falls back to the real company rather than ever handing back a
      // companyId that doesn't resolve to anything.
      const exists = await prisma.company.findUnique({ where: { id: impersonating }, select: { id: true } });
      if (exists) companyId = impersonating;
    }
  }

  return { userId: user.id, email: user.email, companyId, role: user.role, isSuperAdmin, actualCompanyId: user.companyId };
}
