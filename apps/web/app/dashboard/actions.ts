'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappy/db';
import { requireSession } from '../../lib/auth-server';

export interface CompanyNameFormState {
  error?: string;
}

// Used both as the widget's WhatsApp button greeting ("Olá, gostaria de
// falar com a <nome>") and as the fallback company-name match for a cold
// WhatsApp first contact (see lib/bot/conversation.ts#matchCompanyByNameInText)
// — keeping it accurate here is what keeps both of those working.
export async function updateCompanyName(
  _prevState: CompanyNameFormState,
  formData: FormData,
): Promise<CompanyNameFormState> {
  const { companyId } = await requireSession();

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Nome é obrigatório.' };

  await prisma.company.update({ where: { id: companyId }, data: { name } });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/instalacao');
  return {};
}
