import { notFound } from 'next/navigation';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../../lib/auth-server';
import { ReplyForm } from './reply-form';

const SENDER_LABEL: Record<string, string> = {
  customer: 'Cliente',
  bot: 'Bot',
  system: 'Sistema',
};

export default async function TicketDetailPage({ params }: { params: { ticketId: string } }) {
  const { companyId } = await requireSession();

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    include: { customer: true },
  });
  if (!ticket || ticket.companyId !== companyId) notFound();

  const messages = await prisma.message.findMany({
    where: { ticketId: ticket.id, isInternal: false },
    orderBy: { createdAt: 'asc' },
  });

  const agentIds = [...new Set(messages.filter((m) => m.senderType === 'agent' && m.senderId).map((m) => m.senderId!))];
  const agents = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } } })
    : [];
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <>
      <h1 className="dash-h1">
        {ticket.customer?.name ?? ticket.customer?.email ?? ticket.customer?.externalId ?? 'Anônimo'}
      </h1>
      <p className="dash-subtitle">
        {ticket.channel} · <span className={`dash-badge dash-badge-${ticket.status}`}>{ticket.status}</span>
      </p>

      <div className="dash-thread">
        {messages.map((m) => (
          <div key={m.id} className={`dash-bubble dash-bubble-${m.senderType}`}>
            <div className="dash-bubble-meta">
              {m.senderType === 'agent' ? (agentNameById.get(m.senderId ?? '') ?? 'Agente') : SENDER_LABEL[m.senderType]}
            </div>
            {m.content}
          </div>
        ))}
        {messages.length === 0 && <p style={{ color: '#999' }}>Nenhuma mensagem ainda.</p>}
      </div>

      <ReplyForm ticketId={ticket.id} />
    </>
  );
}
