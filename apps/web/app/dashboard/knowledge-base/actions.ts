'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';

export interface ArticleFormState {
  error?: string;
}

export async function createArticle(
  _prevState: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const { companyId, userId } = await requireSession();

  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim() || null;

  if (!title || !content) return { error: 'Título e conteúdo são obrigatórios.' };

  await prisma.kbArticle.create({
    data: { companyId, title, content, category, createdBy: userId },
  });

  revalidatePath('/dashboard/knowledge-base');
  redirect('/dashboard/knowledge-base');
}

export async function updateArticle(
  articleId: string,
  _prevState: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const { companyId } = await requireSession();

  const article = await prisma.kbArticle.findUnique({ where: { id: articleId } });
  if (!article || article.companyId !== companyId) return { error: 'Artigo não encontrado.' };

  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim() || null;
  if (!title || !content) return { error: 'Título e conteúdo são obrigatórios.' };

  await prisma.kbArticle.update({ where: { id: articleId }, data: { title, content, category } });

  revalidatePath('/dashboard/knowledge-base');
  redirect('/dashboard/knowledge-base');
}

export async function toggleArticleActive(articleId: string): Promise<void> {
  const { companyId } = await requireSession();
  const article = await prisma.kbArticle.findUnique({ where: { id: articleId } });
  if (!article || article.companyId !== companyId) return;

  await prisma.kbArticle.update({ where: { id: articleId }, data: { active: !article.active } });
  revalidatePath('/dashboard/knowledge-base');
}

export async function deleteArticle(articleId: string): Promise<void> {
  const { companyId } = await requireSession();
  const article = await prisma.kbArticle.findUnique({ where: { id: articleId } });
  if (!article || article.companyId !== companyId) return;

  await prisma.kbArticle.delete({ where: { id: articleId } });
  revalidatePath('/dashboard/knowledge-base');
}
