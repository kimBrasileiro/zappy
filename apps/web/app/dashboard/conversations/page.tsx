import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';

export default async function ConversationsPage() {
  const { companyId } = await requireSession();

  const tickets = await prisma.ticket.findMany({
    where: { companyId },
    include: { customer: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return (
    <>
      <h1 className="dash-h1">Conversas</h1>
      <p className="dash-subtitle">Todos os tickets da sua empresa, mais recentes primeiro.</p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Canal</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Atualizado em</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <Link href={`/dashboard/conversations/${ticket.id}`}>
                  {ticket.customer?.name ?? ticket.customer?.email ?? ticket.customer?.externalId ?? 'Anônimo'}
                </Link>
              </td>
              <td>{ticket.channel}</td>
              <td>
                <span className={`dash-badge dash-badge-${ticket.status}`}>{ticket.status}</span>
              </td>
              <td>{ticket.priority}</td>
              <td>{ticket.updatedAt.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          {tickets.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: '#999' }}>
                Nenhuma conversa ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
