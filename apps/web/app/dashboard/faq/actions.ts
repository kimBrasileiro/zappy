'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@chat-ia/db';
import { requireSession } from '../../../lib/auth-server';

export interface FaqFormState {
  error?: string;
}

export async function createFaq(
  _prevState: FaqFormState,
  formData: FormData,
): Promise<FaqFormState> {
  const { companyId, userId } = await requireSession();

  const question = String(formData.get('question') ?? '').trim();
  const answer = String(formData.get('answer') ?? '').trim();

  if (!question || !answer) return { error: 'Pergunta e resposta são obrigatórias.' };

  await prisma.faq.create({
    data: { companyId, question, answer, createdBy: userId },
  });

  revalidatePath('/dashboard/faq');
  redirect('/dashboard/faq');
}

export async function updateFaq(
  faqId: string,
  _prevState: FaqFormState,
  formData: FormData,
): Promise<FaqFormState> {
  const { companyId } = await requireSession();

  const faq = await prisma.faq.findUnique({ where: { id: faqId } });
  if (!faq || faq.companyId !== companyId) return { error: 'FAQ não encontrada.' };

  const question = String(formData.get('question') ?? '').trim();
  const answer = String(formData.get('answer') ?? '').trim();
  if (!question || !answer) return { error: 'Pergunta e resposta são obrigatórias.' };

  await prisma.faq.update({ where: { id: faqId }, data: { question, answer } });

  revalidatePath('/dashboard/faq');
  redirect('/dashboard/faq');
}

export async function toggleFaqActive(faqId: string): Promise<void> {
  const { companyId } = await requireSession();
  const faq = await prisma.faq.findUnique({ where: { id: faqId } });
  if (!faq || faq.companyId !== companyId) return;

  await prisma.faq.update({ where: { id: faqId }, data: { active: !faq.active } });
  revalidatePath('/dashboard/faq');
}

export async function deleteFaq(faqId: string): Promise<void> {
  const { companyId } = await requireSession();
  const faq = await prisma.faq.findUnique({ where: { id: faqId } });
  if (!faq || faq.companyId !== companyId) return;

  await prisma.faq.delete({ where: { id: faqId } });
  revalidatePath('/dashboard/faq');
}
