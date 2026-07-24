'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@zappigo/db';
import { auth } from '../../lib/auth';
import { IMPERSONATE_COOKIE, isSuperAdminEmail } from '../../lib/admin-auth';

// Re-checks the hardcoded super-admin email itself rather than trusting the
// caller — dashboard/layout.tsx already gates the UI that triggers this, but
// a server action is independently invocable, so it can't rely on that.
async function assertSuperAdmin(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isSuperAdminEmail(session.user.email)) {
    throw new Error('not_authorized');
  }
}

export async function impersonateCompany(formData: FormData): Promise<void> {
  await assertSuperAdmin();

  const companyId = String(formData.get('companyId') ?? '');
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return;

  (await cookies()).set(IMPERSONATE_COOKIE, company.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  redirect('/dashboard');
}

export async function stopImpersonating(): Promise<void> {
  await assertSuperAdmin();
  (await cookies()).delete(IMPERSONATE_COOKIE);
  redirect('/dashboard');
}
