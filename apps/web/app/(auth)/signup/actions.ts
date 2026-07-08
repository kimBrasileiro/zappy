'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@zappy/db';
import { auth } from '../../../lib/auth';
import { generateUniqueSlug } from '../../../lib/slug';

export interface SignUpState {
  error?: string;
}

export async function signUp(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const companyName = String(formData.get('companyName') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!companyName || !name || !email || !password) {
    return { error: 'Preenche todos os campos.' };
  }
  if (password.length < 8) {
    return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  }

  const slug = await generateUniqueSlug(companyName);
  const company = await prisma.company.create({
    data: { name: companyName, slug, plan: 'starter', status: 'active' },
  });

  try {
    await auth.api.signUpEmail({
      body: { email, password, name, companyId: company.id, role: 'admin' },
      headers: await headers(),
    });
  } catch (err) {
    // Roll back the just-created company so a failed signup (e.g. email
    // already registered) doesn't leave an orphaned, user-less company row.
    await prisma.company.delete({ where: { id: company.id } });
    const message = err instanceof Error ? err.message : 'Não foi possível criar a conta.';
    return { error: message };
  }

  redirect('/dashboard');
}
