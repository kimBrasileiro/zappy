'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { Prisma, prisma } from '@zappigo/db';
import { requireSession } from '../../lib/auth-server';

export interface CompanyProfileFormState {
  error?: string;
}

// Used both as the widget's WhatsApp button greeting ("Olá, gostaria de
// falar com a <nome>") and as the fallback company-name match for a cold
// WhatsApp first contact (see lib/bot/conversation.ts#matchCompanyByNameInText)
// — keeping it accurate here is what keeps both of those working.
// description has no dedicated column — it lives in Company.config (same
// free-form JSON blob orchestrator.ts already reads botName/extraInstructions
// from) — shown on the public /?company=<slug> homepage (app/page.tsx).
export async function updateCompanyProfile(
  _prevState: CompanyProfileFormState,
  formData: FormData,
): Promise<CompanyProfileFormState> {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.home');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: t('errorNameRequired') };
  const description = String(formData.get('description') ?? '').trim();

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { config: true } });
  const config = (company?.config as Record<string, unknown> | null) ?? {};

  await prisma.company.update({
    where: { id: companyId },
    data: { name, config: { ...config, description } as Prisma.InputJsonValue },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/instalacao');
  return {};
}
