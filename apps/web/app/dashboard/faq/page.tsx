import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { createFaq, deleteFaq, toggleFaqActive } from './actions';
import { FaqForm } from './faq-form';

export default async function FaqPage() {
  const { companyId } = await requireSession();

  const faqs = await prisma.faq.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <h1 className="dash-h1">FAQ</h1>
      <p className="dash-subtitle">
        Perguntas frequentes que o bot lista pro cliente quando ele diz que tem dúvidas.
      </p>

      <div className="dash-card">
        <FaqForm action={createFaq} submitLabel="Criar FAQ" />
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Pergunta</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {faqs.map((faq) => (
            <tr key={faq.id}>
              <td>
                <Link href={`/dashboard/faq/${faq.id}`}>{faq.question}</Link>
              </td>
              <td>
                <span className={faq.active ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {faq.active ? 'ativo' : 'inativo'}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <form action={toggleFaqActive.bind(null, faq.id)}>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {faq.active ? 'Desativar' : 'Ativar'}
                  </button>
                </form>
                <form action={deleteFaq.bind(null, faq.id)}>
                  <button type="submit" className="dash-btn dash-btn-danger">
                    Excluir
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {faqs.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: '#999' }}>
                Nenhuma FAQ ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
