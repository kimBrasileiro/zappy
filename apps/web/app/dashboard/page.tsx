import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../lib/auth-server';
import { RefreshButton } from './refresh-button';
import { CopySnippet } from '../copy-snippet';
import { CompanyProfileForm } from './company-name-form';
import { formatDateTime } from '../../lib/format-time';

export default async function DashboardHomePage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.home');
  const locale = await getLocale();

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  const [company, ticketsByStatus, upcomingBookings, totalConfirmedBookings, activeServices, activeFaqs, quickReplies, recentTickets] =
    await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { name: true, slug: true, allowedDomains: true, config: true } }),
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

  const companyDescription = (company?.config as { description?: string } | null)?.description ?? '';

  // "Primeiros passos" — a getting-started checklist, not a permanent
  // fixture: once every step is done the section stops rendering at all
  // (see `allStepsDone` below) so it doesn't clutter the home page for
  // companies that are already up and running.
  const hasDomain = (company?.allowedDomains.length ?? 0) > 0;
  const checklist = [
    { label: t('checklist.service'), href: '/dashboard/services', done: activeServices > 0 },
    { label: t('checklist.faq'), href: '/dashboard/faq', done: activeFaqs > 0 },
    { label: t('checklist.quickReplies'), href: '/dashboard/quick-replies', done: quickReplies > 0 },
    { label: t('checklist.widget'), href: '/dashboard/instalacao', done: hasDomain },
    { label: t('checklist.description'), href: '/dashboard', done: !!companyDescription },
  ];
  const allStepsDone = checklist.every((step) => step.done);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const homepageLink = company ? `${appUrl}/?company=${company.slug}` : null;

  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;
  const whatsappDigits = whatsappNumber?.replace(/\D/g, '');
  const whatsappGreeting = t('whatsappGreeting', { name: company?.name ?? '' });
  const waLink =
    whatsappDigits && company ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappGreeting)}` : null;
  // (11) 97831-4841 instead of the raw +5511978314841 — same reasoning as
  // dashboard/instalacao/page.tsx's copy of this same helper: readable out
  // loud or on a printed sign, not just clickable.
  const formattedWhatsAppNumber = whatsappNumber?.replace(/\D/g, '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  const whatsappNumberLabel = formattedWhatsAppNumber
    ? `+55 (${formattedWhatsAppNumber[1]}) ${formattedWhatsAppNumber[2]}-${formattedWhatsAppNumber[3]}`
    : whatsappNumber;

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('profileCardTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          {t('profileCardBody', { name: company?.name ?? '' })}
        </p>
        <CompanyProfileForm defaultName={company?.name ?? ''} defaultDescription={companyDescription} />
      </div>

      {!allStepsDone && (
        <div className="dash-card">
          <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>{t('checklistTitle')}</h3>
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
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('whatsappCardTitle')}</h3>
        {waLink ? (
          <>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>{t('whatsappShareIntro')}</p>
            <CopySnippet snippet={waLink} />

            <p style={{ color: '#666', fontSize: 13, margin: '16px 0 6px' }}>{t('whatsappNoLinkIntro')}</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>{whatsappNumberLabel}</p>
            <CopySnippet snippet={whatsappGreeting} />
            <p style={{ color: '#999', fontSize: 12, margin: '8px 0 0' }}>{t('whatsappSharedNote')}</p>
          </>
        ) : (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            {t.rich('whatsappNotConfigured', {
              link: (chunks) => <Link href="/dashboard/instalacao">{chunks}</Link>,
            })}
          </p>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('homepageCardTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>{t('homepageCardBody')}</p>
        {homepageLink && <CopySnippet snippet={homepageLink} />}
      </div>

      <div className="dash-section-title">{t('sectionAttendance')}</div>
      <div className="dash-stat-grid">
        <Link href="/dashboard/inbox" className="dash-stat-tile dash-stat-tile-link dash-stat-amber">
          <span className="dash-stat-value">{waitingHuman}</span>
          <span className="dash-stat-label">{t('statWaitingHuman')}</span>
        </Link>
        <div className="dash-stat-tile dash-stat-green">
          <span className="dash-stat-value">{inProgress}</span>
          <span className="dash-stat-label">{t('statInProgress')}</span>
        </div>
        <Link href="/dashboard/conversations" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{totalConversations}</span>
          <span className="dash-stat-label">{t('statTotalConversations')}</span>
        </Link>
      </div>

      <div className="dash-section-title">{t('sectionBookings')}</div>
      <div className="dash-stat-grid">
        <Link href="/dashboard/bookings" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{upcomingBookings}</span>
          <span className="dash-stat-label">{t('statNext7Days')}</span>
        </Link>
        <Link href="/dashboard/bookings" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{totalConfirmedBookings}</span>
          <span className="dash-stat-label">{t('statTotalConfirmed')}</span>
        </Link>
      </div>

      <div className="dash-section-title">{t('sectionContent')}</div>
      <div className="dash-stat-grid">
        <Link href="/dashboard/services" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{activeServices}</span>
          <span className="dash-stat-label">{t('statActiveServices')}</span>
        </Link>
        <Link href="/dashboard/faq" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{activeFaqs}</span>
          <span className="dash-stat-label">{t('statActiveFaqs')}</span>
        </Link>
        <Link href="/dashboard/quick-replies" className="dash-stat-tile dash-stat-tile-link">
          <span className="dash-stat-value">{quickReplies}</span>
          <span className="dash-stat-label">{t('statQuickReplies')}</span>
        </Link>
      </div>

      <div className="dash-section-title">{t('sectionRecent')}</div>
      <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableCustomer')}</th>
            <th>{t('tableChannel')}</th>
            <th>{t('tableStatus')}</th>
            <th>{t('tableUpdatedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {recentTickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <Link href={`/dashboard/conversations/${ticket.id}`}>
                  {ticket.customer?.name ?? ticket.customer?.email ?? ticket.customer?.externalId ?? t('anonymous')}
                </Link>
              </td>
              <td>{ticket.channel}</td>
              <td>
                <span className={`dash-badge dash-badge-${ticket.status}`}>{ticket.status}</span>
              </td>
              <td>{formatDateTime(ticket.updatedAt, locale)}</td>
            </tr>
          ))}
          {recentTickets.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: '#999' }}>
                {t('noConversations')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
