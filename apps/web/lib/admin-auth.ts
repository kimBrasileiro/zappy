import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';

// Platform-wide access, deliberately not the company-scoped `role` field
// (admin|agent|viewer) — that's a different authorization boundary. Fixed
// to this one email as requested; isolated here so it's easy to find/change.
const SUPER_ADMIN_EMAIL = 'kim@wisell.ai';

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
  if (user.email !== SUPER_ADMIN_EMAIL) {
    redirect('/dashboard');
  }

  return { userId: user.id, email: user.email };
}
