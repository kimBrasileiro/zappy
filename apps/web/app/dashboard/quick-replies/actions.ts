'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';

export interface TemplateFormState {
  error?: string;
}

export async function createTemplate(
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const { companyId, userId } = await requireSession();

  const name = String(formData.get('name') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const shortcut = String(formData.get('shortcut') ?? '').trim() || null;
  const category = String(formData.get('category') ?? '').trim() || null;

  if (!name || !content) return { error: 'Nome e conteúdo são obrigatórios.' };

  await prisma.responseTemplate.create({
    data: { companyId, name, content, shortcut, category, createdBy: userId },
  });

  revalidatePath('/dashboard/quick-replies');
  redirect('/dashboard/quick-replies');
}

export async function updateTemplate(
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const { companyId } = await requireSession();

  const template = await prisma.responseTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.companyId !== companyId) return { error: 'Template não encontrado.' };

  const name = String(formData.get('name') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const shortcut = String(formData.get('shortcut') ?? '').trim() || null;
  const category = String(formData.get('category') ?? '').trim() || null;
  if (!name || !content) return { error: 'Nome e conteúdo são obrigatórios.' };

  await prisma.responseTemplate.update({
    where: { id: templateId },
    data: { name, content, shortcut, category },
  });

  revalidatePath('/dashboard/quick-replies');
  redirect('/dashboard/quick-replies');
}

export async function toggleTemplateActive(templateId: string): Promise<void> {
  const { companyId } = await requireSession();
  const template = await prisma.responseTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.companyId !== companyId) return;

  await prisma.responseTemplate.update({
    where: { id: templateId },
    data: { active: !template.active },
  });
  revalidatePath('/dashboard/quick-replies');
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { companyId } = await requireSession();
  const template = await prisma.responseTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.companyId !== companyId) return;

  await prisma.responseTemplate.delete({ where: { id: templateId } });
  revalidatePath('/dashboard/quick-replies');
}
