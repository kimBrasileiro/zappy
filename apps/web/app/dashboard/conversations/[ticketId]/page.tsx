import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { formatRelativeTime } from '../../../../lib/format-time';
import { isWithinWhatsAppSessionWindow } from '../../../../lib/whatsapp/client';
import { Avatar } from '../../avatar';
import { ReplyForm } from './reply-form';
import { resolveTicket } from './actions';
import { RefreshButton } from '../../refresh-button';

export default async function TicketDetailPage({ params }: { params: { ticketId: string } }) {
  const { companyId } = await requireSession();
  const [t, locale] = await Promise.all([getTranslations('dashboard.conversations'), getLocale()]);

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

  const displayName = ticket.customer?.name ?? ticket.customer?.email ?? ticket.customer?.externalId ?? t('anonymous');

  // Same reasoning as sendAgentReply's own check (actions.ts) — reused here
  // just to warn the agent before they type instead of after. The server
  // action is still the actual gate; this is purely informational and can
  // go slightly stale (e.g. a new customer message lands right after this
  // render) without being a correctness problem.
  const lastCustomerMessage = [...messages].reverse().find((m) => m.senderType === 'customer');
  const sessionWindowClosed = ticket.channel === 'whatsapp' && !isWithinWhatsAppSessionWindow(lastCustomerMessage?.createdAt ?? null);

  return (
    <>
      <Link href="/dashboard/inbox" className="dash-back-link">
        ← {t('backToInbox')}
      </Link>

      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{displayName}</h1>
          <div className="dash-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
            {ticket.channel} · <span className={`dash-badge dash-badge-${ticket.status}`}>{ticket.status}</span>
            {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <form action={resolveTicket.bind(null, ticket.id)}>
                <button type="submit" className="dash-btn">
                  {t('resolveButton')}
                </button>
              </form>
            )}
          </div>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-conversation-layout">
        <div className="dash-conversation-main">
          <div className="dash-thread">
            {messages.map((m) => {
              const label = m.senderType === 'agent' ? (agentNameById.get(m.senderId ?? '') ?? t('senderAgentFallback')) : senderLabel[m.senderType];
              return (
                <div key={m.id} className={`dash-bubble-row dash-bubble-row-${m.senderType}`}>
                  <Avatar name={m.senderType === 'customer' ? displayName : label} seed={m.senderId ?? m.senderType} className="dash-bubble-avatar" size={26} />
                  <div>
                    <div className="dash-bubble-meta">
                      <span>{label}</span>
                      <span>{formatRelativeTime(m.createdAt, locale)}</span>
                    </div>
                    <div className={`dash-bubble dash-bubble-${m.senderType}`}>{m.content}</div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <p style={{ color: '#999' }}>{t('noMessages')}</p>}
          </div>

          <ReplyForm ticketId={ticket.id} sessionWindowClosed={sessionWindowClosed} />
        </div>

        <div className="dash-customer-panel dash-card">
          <div className="dash-section-title" style={{ margin: '0 0 14px' }}>
            {t('customerPanelTitle')}
          </div>
          <div className="dash-customer-panel-row">
            <span className="dash-customer-panel-label">{t('channelLabel')}</span>
            <span className="dash-customer-panel-value">{ticket.channel}</span>
          </div>
          <div className="dash-customer-panel-row">
            <span className="dash-customer-panel-label">{t('phoneLabel')}</span>
            <span className="dash-customer-panel-value">{ticket.customer?.phone ?? t('noPhone')}</span>
          </div>
          <div className="dash-customer-panel-row">
            <span className="dash-customer-panel-label">{t('emailLabel')}</span>
            <span className="dash-customer-panel-value">{ticket.customer?.email ?? t('noEmail')}</span>
          </div>
          {ticket.customer?.createdAt && (
            <div className="dash-customer-panel-row">
              <span className="dash-customer-panel-label">{t('customerSince')}</span>
              <span className="dash-customer-panel-value">{formatRelativeTime(ticket.customer.createdAt, locale)}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
