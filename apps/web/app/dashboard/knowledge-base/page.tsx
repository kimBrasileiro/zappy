import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { createArticle, deleteArticle, toggleArticleActive } from './actions';
import { ArticleForm } from './article-form';

export default async function KnowledgeBasePage() {
  const { companyId } = await requireSession();

  const articles = await prisma.kbArticle.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <h1 className="dash-h1">Base de Conhecimento</h1>
      <p className="dash-subtitle">
        Artigos usados pelo bot para responder perguntas frequentes. A geração de embeddings pra
        busca semântica entra numa fase seguinte (precisa de uma chave OpenAI/Voyage).
      </p>

      <div className="dash-card">
        <ArticleForm action={createArticle} submitLabel="Criar artigo" />
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Categoria</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr key={article.id}>
              <td>
                <Link href={`/dashboard/knowledge-base/${article.id}`}>{article.title}</Link>
              </td>
              <td>{article.category ?? '—'}</td>
              <td>
                <span className={article.active ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {article.active ? 'ativo' : 'inativo'}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <form action={toggleArticleActive.bind(null, article.id)}>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {article.active ? 'Desativar' : 'Ativar'}
                  </button>
                </form>
                <form action={deleteArticle.bind(null, article.id)}>
                  <button type="submit" className="dash-btn dash-btn-danger">
                    Excluir
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {articles.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: '#999' }}>
                Nenhum artigo ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
