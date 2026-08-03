'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '../../../lib/auth-server';
import { regenerateLeadsForCompany } from '../../../lib/leads/leads-query';

export async function regenerateLeadsAction(): Promise<void> {
  const { companyId } = await requireSession();
  await regenerateLeadsForCompany(companyId);
  revalidatePath('/dashboard/leads');
}
