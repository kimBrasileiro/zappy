import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';

export default async function InboxPage() {
  const { companyId } = await requireSession();

  const tickets = await prisma.ticket.findMany({
    where: { companyId, status: { in: ['waiting_human', 'in_progress'] } },
    include: { customer: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return (
    <>
      <h1 className="dash-h1">Inbox</h1>
      <p className="dash-subtitle">
        Conversas que precisam de um atendente — escaladas pelo bot ou já assumidas por alguém do time.
      </p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Canal</th>
            <th>Status</th>
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
              <td>{ticket.updatedAt.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          {tickets.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: '#999' }}>
                Nenhuma conversa esperando atendimento humano no momento.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
