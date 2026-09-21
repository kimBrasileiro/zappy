import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { formatDateTime, getDeploymentTimezone } from '../../../../lib/format-time';
import { updateCustomerNotes } from '../actions';
import { NotesForm } from '../notes-form';
import { isSportsCompany } from '../../../../lib/modality';
import { LEVEL_LABELS, SPORT_LABELS } from '../../../../lib/sports/constants';
import { saveClientSportLevel } from '../../sports-actions';

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'dash-badge-in_progress',
  completed: 'dash-badge-open',
  cancelled: 'dash-badge-closed',
  no_show: 'dash-badge-canceled',
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.clients');
  const tBookings = await getTranslations('dashboard.bookings');
  const locale = await getLocale();
  const timeZone = getDeploymentTimezone();

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      bookings: {
        include: { service: true },
        orderBy: { scheduledAt: 'desc' },
      },
    },
  });
  if (!customer || customer.companyId !== companyId) notFound();

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { config: true } });
  const isSports = !!company && isSportsCompany(company);
  const tSports = isSports ? await getTranslations('dashboard.sports') : null;
  const [sportLevels, enrollments] = isSports
    ? await Promise.all([
        prisma.customerSportLevel.findMany({ where: { companyId, customerId: customer.id } }),
        prisma.classEnrollment.findMany({
          where: { companyId, customerId: customer.id },
          include: { class: { include: { court: { select: { name: true } } } } },
          orderBy: { date: 'desc' },
          take: 20,
        }),
      ])
    : [[], []];

  const completed = customer.bookings.filter((b) => b.status === 'completed');
  const totalSpentCents = completed.reduce((sum, b) => sum + b.priceCents, 0);

  const statusLabel: Record<string, string> = {
    confirmed: tBookings('statusConfirmed'),
    completed: tBookings('statusCompleted'),
    cancelled: tBookings('statusCancelled'),
    no_show: tBookings('statusNoShow'),
  };

  return (
    <>
      <Link href="/dashboard/clients" className="dash-back-link">
        ← {t('title')}
      </Link>

      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{customer.name ?? customer.email ?? customer.externalId ?? t('anonymous')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {customer.phone ?? '—'}
            {customer.email ? ` · ${customer.email}` : ''}
          </p>
        </div>
      </div>

      <div className="dash-stat-grid">
        <div className="dash-stat-tile">
          <span className="dash-stat-value">{completed.length}</span>
          <span className="dash-stat-label">{t('statVisits')}</span>
        </div>
        <div className="dash-stat-tile dash-stat-green">
          <span className="dash-stat-value">{formatPrice(totalSpentCents)}</span>
          <span className="dash-stat-label">{t('statTotalSpent')}</span>
        </div>
        <div className="dash-stat-tile dash-stat-amber">
          <span className="dash-stat-value">
            {customer.bookings[0] ? formatDateTime(customer.bookings[0].scheduledAt, locale, timeZone) : '—'}
          </span>
          <span className="dash-stat-label">{t('statLastActivity')}</span>
        </div>
      </div>

      {isSports && tSports && (
        <div className="dash-card">
          <div className="dash-section-title" style={{ marginTop: 0 }}>{tSports('studentLevels')}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(SPORT_LABELS).map(([sport, sportLabel]) => {
              const current = sportLevels.find((l) => l.sport === sport)?.level ?? '';
              return (
                <form key={sport} action={saveClientSportLevel.bind(null, customer.id, sport)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 110, fontWeight: 600 }}>{sportLabel}</span>
                  <select name="level" defaultValue={current} style={{ flex: '1 1 140px' }}>
                    <option value="">{tSports('noLevel')}</option>
                    {Object.entries(LEVEL_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {tSports('saveLevel')}
                  </button>
                </form>
              );
            })}
          </div>
          {enrollments.length > 0 && (
            <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6, fontSize: 13.5 }}>
              {enrollments.map((e) => (
                <li key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, opacity: e.status === 'cancelled' ? 0.5 : 1 }}>
                  <span>
                    {e.date.toISOString().slice(0, 10).split('-').reverse().join('/')} · {e.class.startTime} · {e.class.court.name} ·{' '}
                    {SPORT_LABELS[e.class.sport as keyof typeof SPORT_LABELS] ?? e.class.sport}
                  </span>
                  <span style={{ color: '#888' }}>{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('notesTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>{t('notesBody')}</p>
        <NotesForm action={updateCustomerNotes.bind(null, customer.id)} defaultNotes={customer.notes ?? ''} />
      </div>

      <div className="dash-section-title">{t('historyTitle')}</div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>{tBookings('tableService')}</th>
              <th>{tBookings('tableDateTime')}</th>
              <th>{tBookings('tablePrice')}</th>
              <th>{tBookings('tableStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {customer.bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{booking.service.name}</td>
                <td>{formatDateTime(booking.scheduledAt, locale, timeZone)}</td>
                <td>{formatPrice(booking.priceCents)}</td>
                <td>
                  <span className={`dash-badge ${STATUS_BADGE[booking.status] ?? 'dash-badge-closed'}`}>
                    {statusLabel[booking.status] ?? booking.status}
                  </span>
                </td>
              </tr>
            ))}
            {customer.bookings.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: '#999' }}>
                  {t('noHistory')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
