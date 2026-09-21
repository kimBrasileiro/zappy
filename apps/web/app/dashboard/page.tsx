import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../lib/auth-server';
import { RefreshButton } from './refresh-button';
import { CopySnippet } from '../copy-snippet';
import { CompanyProfileForm } from './company-name-form';
import { formatDateTime } from '../../lib/format-time';

// Same set of line icons as nav-links.tsx (see that file's own comment on
// why each file keeps its own small icon consts here instead of a shared
// module) — reused for the "Atalhos rápidos" tiles so a shortcut and its
// matching sidebar item always show the same glyph.
const ICON_BOOKINGS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_CLIENTS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17" cy="9" r="2.3" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_REPORTS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20V11M10 20V4M16 20v-6M4 20h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_SERVICES = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 11.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>`;
const ICON_WAVE = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 12V5a1.5 1.5 0 0 1 3 0v7M14 12.2V6.5a1.5 1.5 0 0 1 3 0V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12.5 6.6 11a1.6 1.6 0 0 0-2.4 2.1l3.4 4.2A6 6 0 0 0 12.3 20H14a5 5 0 0 0 5-5v-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default async function DashboardHomePage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.home');
  const tNav = await getTranslations('dashboard.nav');
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

  const companyConfig = company?.config as { description?: string; address?: string } | null;
  const companyDescription = companyConfig?.description ?? '';
  const companyAddress = companyConfig?.address ?? '';

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

      <div className="dash-greeting-card">
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
            {t('greeting', { name: company?.name ?? '' })}
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: '#666' }}>{t('greetingSubtitle')}</p>
        </div>
        <span className="dash-greeting-icon" dangerouslySetInnerHTML={{ __html: ICON_WAVE }} />
      </div>

      <div className="dash-shortcut-grid">
        <Link href="/dashboard/bookings" className="dash-shortcut-tile">
          <span className="dash-shortcut-icon" dangerouslySetInnerHTML={{ __html: ICON_BOOKINGS }} />
          <span className="dash-shortcut-label">{tNav('bookings')}</span>
        </Link>
        <Link href="/dashboard/clients" className="dash-shortcut-tile">
          <span className="dash-shortcut-icon" dangerouslySetInnerHTML={{ __html: ICON_CLIENTS }} />
          <span className="dash-shortcut-label">{tNav('clients')}</span>
        </Link>
        <Link href="/dashboard/reports" className="dash-shortcut-tile">
          <span className="dash-shortcut-icon" dangerouslySetInnerHTML={{ __html: ICON_REPORTS }} />
          <span className="dash-shortcut-label">{tNav('reports')}</span>
        </Link>
        <Link href="/dashboard/services" className="dash-shortcut-tile">
          <span className="dash-shortcut-icon" dangerouslySetInnerHTML={{ __html: ICON_SERVICES }} />
          <span className="dash-shortcut-label">{tNav('services')}</span>
        </Link>
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('profileCardTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          {t('profileCardBody', { name: company?.name ?? '' })}
        </p>
        <CompanyProfileForm defaultName={company?.name ?? ''} defaultDescription={companyDescription} defaultAddress={companyAddress} />
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
