'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@chat-ia/db';
import { auth } from '../../lib/auth';
import { generateUniqueSlug } from '../../lib/slug';

export interface OnboardingState {
  error?: string;
}

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const companyName = String(formData.get('companyName') ?? '').trim();
  if (!companyName) {
    return { error: 'Digite o nome da sua empresa.' };
  }

  const slug = await generateUniqueSlug(companyName);
  const company = await prisma.company.create({
    data: { name: companyName, slug, plan: 'starter', status: 'active' },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { companyId: company.id, role: 'admin' },
  });

  redirect('/dashboard');
}
