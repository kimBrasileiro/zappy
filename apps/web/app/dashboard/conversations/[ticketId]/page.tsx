import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { ReplyForm } from './reply-form';
import { resolveTicket } from './actions';
import { RefreshButton } from '../../refresh-button';

export default async function TicketDetailPage({ params }: { params: { ticketId: string } }) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.conversations');

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

  const senderLabel: Record<string, string> = {
    customer: t('senderCustomer'),
    bot: t('senderBot'),
    system: t('senderSystem'),
  };

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">
            {ticket.customer?.name ?? ticket.customer?.email ?? ticket.customer?.externalId ?? t('anonymous')}
          </h1>
          <p className="dash-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
            {ticket.channel} · <span className={`dash-badge dash-badge-${ticket.status}`}>{ticket.status}</span>
            {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <form action={resolveTicket.bind(null, ticket.id)}>
                <button type="submit" className="dash-btn">
                  {t('resolveButton')}
                </button>
              </form>
            )}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-thread">
        {messages.map((m) => (
          <div key={m.id} className={`dash-bubble dash-bubble-${m.senderType}`}>
            <div className="dash-bubble-meta">
              {m.senderType === 'agent' ? (agentNameById.get(m.senderId ?? '') ?? t('senderAgentFallback')) : senderLabel[m.senderType]}
            </div>
            {m.content}
          </div>
        ))}
        {messages.length === 0 && <p style={{ color: '#999' }}>{t('noMessages')}</p>}
      </div>

      <ReplyForm ticketId={ticket.id} />
    </>
  );
}
