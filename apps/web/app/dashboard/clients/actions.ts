'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';

export interface NotesFormState {
  error?: string;
  success?: boolean;
}

export async function updateCustomerNotes(
  customerId: string,
  _prevState: NotesFormState,
  formData: FormData,
): Promise<NotesFormState> {
  const { companyId } = await requireSession();
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { companyId: true } });
  if (!customer || customer.companyId !== companyId) return { error: 'not_found' };

  const notes = String(formData.get('notes') ?? '').slice(0, 4000);
  await prisma.customer.update({ where: { id: customerId }, data: { notes } });
  revalidatePath(`/dashboard/clients/${customerId}`);
  return { success: true };
}
