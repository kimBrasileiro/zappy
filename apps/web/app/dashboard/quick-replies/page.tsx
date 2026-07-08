import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { createTemplate, deleteTemplate, toggleTemplateActive } from './actions';
import { TemplateForm } from './template-form';

export default async function QuickRepliesPage() {
  const { companyId } = await requireSession();

  const templates = await prisma.responseTemplate.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <h1 className="dash-h1">Quick Replies</h1>
      <p className="dash-subtitle">Respostas rápidas que sua equipe usa no dia a dia.</p>

      <div className="dash-card">
        <TemplateForm action={createTemplate} submitLabel="Criar quick reply" />
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Atalho</th>
            <th>Categoria</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id}>
              <td>
                <Link href={`/dashboard/quick-replies/${template.id}`}>{template.name}</Link>
              </td>
              <td>{template.shortcut ?? '—'}</td>
              <td>{template.category ?? '—'}</td>
              <td>
                <span className={template.active ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {template.active ? 'ativo' : 'inativo'}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <form action={toggleTemplateActive.bind(null, template.id)}>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {template.active ? 'Desativar' : 'Ativar'}
                  </button>
                </form>
                <form action={deleteTemplate.bind(null, template.id)}>
                  <button type="submit" className="dash-btn dash-btn-danger">
                    Excluir
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {templates.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: '#999' }}>
                Nenhum quick reply ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
