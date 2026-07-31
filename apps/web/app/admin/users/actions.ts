'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSuperAdmin } from '../../../lib/admin-auth';

export interface UserFormState {
  error?: string;
}

export async function updateUser(
  userId: string,
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireSuperAdmin();
  const t = await getTranslations('admin.users');

  const name = String(formData.get('name') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();

  if (!name) return { error: t('errorNameRequired') };
  if (!['admin', 'agent', 'viewer'].includes(role)) return { error: t('errorInvalidRole') };

  await prisma.user.update({ where: { id: userId }, data: { name, role } });

  revalidatePath('/admin/users');
  redirect('/admin/users');
}

export async function toggleUserActive(userId: string): Promise<void> {
  const { userId: callerId } = await requireSuperAdmin();

  // Don't let the super-admin lock themselves out with no way back in
  // short of direct DB access.
  if (userId === callerId) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Soft-delete only — never removed from the table or the list, per the
  // explicit requirement: "deletar" here means status flips, nothing else.
  await prisma.user.update({
    where: { id: userId },
    data: { status: user.status === 'active' ? 'inactive' : 'active' },
  });

  revalidatePath('/admin/users');
}
