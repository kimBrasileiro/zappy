import { notFound } from 'next/navigation';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../../lib/auth-server';
import { updateArticle } from '../actions';
import { ArticleForm } from '../article-form';

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();

  const article = await prisma.kbArticle.findUnique({ where: { id: params.id } });
  if (!article || article.companyId !== companyId) notFound();

  return (
    <>
      <h1 className="dash-h1">Editar artigo</h1>
      <div className="dash-card">
        <ArticleForm
          action={updateArticle.bind(null, article.id)}
          defaultValues={{ title: article.title, content: article.content, category: article.category }}
          submitLabel="Salvar alterações"
        />
      </div>
    </>
  );
}
