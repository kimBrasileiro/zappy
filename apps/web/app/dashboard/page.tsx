import Link from 'next/link';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../lib/auth-server';
import { RefreshButton } from './refresh-button';
import { CopySnippet } from '../copy-snippet';
import { CompanyNameForm } from './company-name-form';

export default async function DashboardHomePage() {
  const { companyId } = await requireSession();

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  const [company, ticketsByStatus, upcomingBookings, totalConfirmedBookings, activeServices, activeFaqs, quickReplies, recentTickets] =
    await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { name: true, slug: true, allowedDomains: true } }),
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

  // "Primeiros passos" — a getting-started checklist, not a permanent
  // fixture: once every step is done the section stops rendering at all
  // (see `allStepsDone` below) so it doesn't clutter the home page for
  // companies that are already up and running.
  const hasDomain = (company?.allowedDomains.length ?? 0) > 0;
  const checklist = [
    { label: 'Cadastre seu primeiro serviço', href: '/dashboard/services', done: activeServices > 0 },
    { label: 'Cadastre suas primeiras FAQs', href: '/dashboard/faq', done: activeFaqs > 0 },
    { label: 'Crie Quick Replies para respostas comuns', href: '/dashboard/quick-replies', done: quickReplies > 0 },
    { label: 'Instale o widget no site da sua empresa', href: '/dashboard/instalacao', done: hasDomain },
  ];
  const allStepsDone = checklist.every((step) => step.done);

  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;
  const whatsappDigits = whatsappNumber?.replace(/\D/g, '');
  const waLink =
    whatsappDigits && company
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá, gostaria de agendar serviços com ${company.name}`)}`
      : null;

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

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Nome da empresa</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Esse nome aparece pro cliente no botão de WhatsApp do widget (ex: "Olá, gostaria de
          agendar serviços com {company?.name}") e é como o bot se identifica nas conversas.
        </p>
        <CompanyNameForm defaultName={company?.name ?? ''} />
      </div>

      {!allStepsDone && (
        <div className="dash-card">
          <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Primeiros passos</h3>
          <ul className="dash-checklist">
            {checklist.map((step) => (
              <li key={step.href} className="dash-checklist-item">
                <span className={`dash-checklist-check ${step.done ? 'dash-checklist-check-done' : ''}`}>
                  {step.done ? '✓' : ''}
                </span>
                {step.done ? (
                  <span className="dash-checklist-label-done">{step.label}</span>
                ) : (
                  <Link href={step.href} className="dash-checklist-label">
                    {step.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Link direto do WhatsApp</h3>
        {waLink ? (
          <>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
              Compartilhe este link (redes sociais, bio, QR code) pra clientes iniciarem uma
              conversa já identificando sua empresa pro bot:
            </p>
            <CopySnippet snippet={waLink} />
          </>
        ) : (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            O número compartilhado de WhatsApp da Zappigo ainda não foi configurado nesta
            instância — assim que estiver, o link aparece aqui automaticamente. Veja mais em{' '}
            <Link href="/dashboard/instalacao">Instalação</Link>.
          </p>
        )}
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
