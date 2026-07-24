'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { normalizeDomain } from '../../../lib/domains';

export interface DomainsFormState {
  error?: string;
}

export async function updateAllowedDomains(
  _prevState: DomainsFormState,
  formData: FormData,
): Promise<DomainsFormState> {
  const { companyId } = await requireSession();

  const raw = String(formData.get('domains') ?? '');
  const domains = [
    ...new Set(
      raw
        .split('\n')
        .map((line) => normalizeDomain(line))
        .filter(Boolean),
    ),
  ];

  await prisma.company.update({ where: { id: companyId }, data: { allowedDomains: domains } });

  revalidatePath('/dashboard/instalacao');
  return {};
}
