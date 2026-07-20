import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSession } from '../../lib/auth-server';
import { RefreshButton } from './refresh-button';

export default async function DashboardHomePage() {
  const { companyId } = await requireSession();

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  const [ticketsByStatus, upcomingBookings, totalConfirmedBookings, activeServices, activeFaqs, quickReplies, recentTickets] =
    await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], where: { companyId }, _count: true }),
      prisma.booking.count({
        where: { companyId, status: 'confirmed', scheduledAt: { gte: now, lte: weekFromNow } },
      }),
      prisma.booking.count({ where: { companyId, status: 'confirmed' } }),
      prisma.service.count({ where: { companyId, active: true } }),
      prisma.faq.count({ where: { companyId, active: true } }),
      prisma.responseTemplate.count({ where: { companyId, active: true } }),
      prisma.ticket.findMany({
        where: { companyId },
        include: { customer: true },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
    ]);

  const countByStatus = Object.fromEntries(ticketsByStatus.map((t) => [t.status, t._count]));
  const waitingHuman = countByStatus['waiting_human'] ?? 0;
  const inProgress = countByStatus['in_progress'] ?? 0;
  const totalConversations = ticketsByStatus.reduce((sum, t) => sum + t._count, 0);

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">Visão geral</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            Resumo da sua empresa, atualizado agora.
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-section-title">Atendimento</div>
      <div className="dash-stat-grid">
        <Link href="/dashboard/inbox" className="dash-stat-tile dash-stat-tile-link dash-stat-amber">
          <span className="dash-stat-value">{waitingHuman}</span>
          <span className="dash-stat-label">Aguardando humano</span>
        </Link>
        <div className="dash-stat-tile dash-stat-green">
          <span className="dash-stat-value">{inProgress}</span>
          <span className="dash-stat-label">Em andamento</span>
        </div>
        <Link href="/dashboard/conversations" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{totalConversations}</span>
          <span className="dash-stat-label">Total de conversas</span>
        </Link>
      </div>

      <div className="dash-section-title">Agendamentos</div>
      <div className="dash-stat-grid">
        <Link href="/dashboard/bookings" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{upcomingBookings}</span>
          <span className="dash-stat-label">Nos próximos 7 dias</span>
        </Link>
        <Link href="/dashboard/bookings" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{totalConfirmedBookings}</span>
          <span className="dash-stat-label">Total confirmados</span>
        </Link>
      </div>

      <div className="dash-section-title">Conteúdo cadastrado</div>
      <div className="dash-stat-grid">
        <Link href="/dashboard/services" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{activeServices}</span>
          <span className="dash-stat-label">Serviços ativos</span>
        </Link>
        <Link href="/dashboard/faq" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{activeFaqs}</span>
          <span className="dash-stat-label">FAQs cadastradas</span>
        </Link>
        <Link href="/dashboard/quick-replies" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{quickReplies}</span>
          <span className="dash-stat-label">Quick Replies</span>
        </Link>
      </div>

      <div className="dash-section-title">Conversas recentes</div>
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
          {recentTickets.map((ticket) => (
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
          {recentTickets.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: '#999' }}>
                Nenhuma conversa ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
