import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';

export interface RequireSessionResult {
  userId: string;
  companyId: string;
  role: string;
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

  return { userId: user.id, companyId: user.companyId, role: user.role };
}
