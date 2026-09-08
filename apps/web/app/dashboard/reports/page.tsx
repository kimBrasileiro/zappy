import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { getDeploymentTimezone } from '../../../lib/format-time';
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from '../../../lib/bot/services';

const DAY_MS = 24 * 60 * 60_000;
const PERIOD_OPTIONS = [7, 30, 90] as const;

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function toMinutesOfDay(hhmm: string): number {
  const parts = hhmm.split(':');
  return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
}

function minutesBetween(open: string, close: string): number {
  return toMinutesOfDay(close) - toMinutesOfDay(open);
}

// This deployment's own weekday for `date`, not the server process's local
// day — matters right around midnight, where a UTC-based getDay() can land
// on the wrong side of the date line from what the business (and
// DEFAULT_BUSINESS_HOURS' sun/mon/... keys) actually means.
function dayKeyOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date).slice(0, 3).toLowerCase();
}

export default async function ReportsPage({ searchParams }: { searchParams: { period?: string } }) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.reports');
  const timeZone = getDeploymentTimezone();

  const periodDays = PERIOD_OPTIONS.includes(Number(searchParams.period) as (typeof PERIOD_OPTIONS)[number])
    ? Number(searchParams.period)
    : 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * DAY_MS);

  const [bookings, newClientsCount, company] = await Promise.all([
    prisma.booking.findMany({
      where: { companyId, scheduledAt: { gte: periodStart, lte: now } },
      include: { service: { select: { name: true } }, customer: { select: { name: true, email: true, externalId: true } } },
    }),
    prisma.customer.count({ where: { companyId, createdAt: { gte: periodStart, lte: now } } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { config: true } }),
  ]);

  const completed = bookings.filter((b) => b.status === 'completed');
  const cancelled = bookings.filter((b) => b.status === 'cancelled');
  const noShow = bookings.filter((b) => b.status === 'no_show');
  const resolvedCount = completed.length + cancelled.length + noShow.length;
  const revenueCents = completed.reduce((sum, b) => sum + b.priceCents, 0);
  const cancellationRate = resolvedCount > 0 ? (cancelled.length + noShow.length) / resolvedCount : null;

  const byService = new Map<string, { name: string; count: number; revenueCents: number }>();
  const byClient = new Map<string, { name: string; count: number; revenueCents: number }>();
  for (const b of completed) {
    const s = byService.get(b.serviceId) ?? { name: b.service.name, count: 0, revenueCents: 0 };
    s.count += 1;
    s.revenueCents += b.priceCents;
    byService.set(b.serviceId, s);

    if (b.customerId) {
      const c = byClient.get(b.customerId) ?? {
        name: b.customer?.name ?? b.customer?.email ?? b.customer?.externalId ?? t('anonymous'),
        count: 0,
        revenueCents: 0,
      };
      c.count += 1;
      c.revenueCents += b.priceCents;
      byClient.set(b.customerId, c);
    }
  }
  const topServices = [...byService.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5);
  const topClients = [...byClient.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5);
  const maxServiceRevenue = topServices[0]?.revenueCents ?? 0;
  const maxClientRevenue = topClients[0]?.revenueCents ?? 0;

  // Occupancy — an estimate, not a real capacity model: it treats the
  // business as a single resource (this deployment has no per-staff-member
  // parallel-capacity concept to sum over), comparing booked minutes against
  // the company's own configured open hours for each day in the period. See
  // lib/bot/services.ts#getBusinessHours for the same fallback-to-default
  // logic the bot itself uses for availability.
  const businessHours = ((company?.config as { businessHours?: BusinessHours } | null)?.businessHours) ?? DEFAULT_BUSINESS_HOURS;
  let availableMinutes = 0;
  for (let d = new Date(periodStart); d <= now; d = new Date(d.getTime() + DAY_MS)) {
    const hours = businessHours[dayKeyOf(d, timeZone)];
    if (hours) availableMinutes += minutesBetween(hours[0], hours[1]);
  }
  const bookedMinutes = bookings
    .filter((b) => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => sum + b.durationMinutes, 0);
  const occupancyRate = availableMinutes > 0 ? Math.min(1, bookedMinutes / availableMinutes) : null;

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIOD_OPTIONS.map((days) => (
            <Link
              key={days}
              href={`/dashboard/reports?period=${days}`}
              className={days === periodDays ? 'dash-btn' : 'dash-btn dash-btn-secondary'}
            >
              {t('periodDays', { days })}
            </Link>
          ))}
        </div>
      </div>

      <div className="dash-stat-grid">
        <div className="dash-stat-tile dash-stat-green">
          <span className="dash-stat-value">{formatPrice(revenueCents)}</span>
          <span className="dash-stat-label">{t('statRevenue')}</span>
        </div>
        <div className="dash-stat-tile">
          <span className="dash-stat-value">{completed.length}</span>
          <span className="dash-stat-label">{t('statCompleted')}</span>
        </div>
        <div className="dash-stat-tile dash-stat-amber">
          <span className="dash-stat-value">{cancellationRate !== null ? formatPercent(cancellationRate) : '—'}</span>
          <span className="dash-stat-label">{t('statCancellationRate')}</span>
        </div>
        <div className="dash-stat-tile">
          <span className="dash-stat-value">{newClientsCount}</span>
          <span className="dash-stat-label">{t('statNewClients')}</span>
        </div>
        <div className="dash-stat-tile">
          <span className="dash-stat-value">{occupancyRate !== null ? formatPercent(occupancyRate) : '—'}</span>
          <span className="dash-stat-label">{t('statOccupancy')}</span>
        </div>
      </div>

      <div className="dash-section-title">{t('sectionTopServices')}</div>
      <div className="dash-card">
        {topServices.length === 0 ? (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{t('noData')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topServices.map((s) => (
              <div key={s.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>
                    {s.name} <span style={{ color: '#999' }}>· {t('bookingsCount', { count: s.count })}</span>
                  </span>
                  <strong>{formatPrice(s.revenueCents)}</strong>
                </div>
                <div style={{ background: 'var(--dash-gray-100)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${maxServiceRevenue > 0 ? (s.revenueCents / maxServiceRevenue) * 100 : 0}%`,
                      background: 'var(--dash-brand)',
                      height: '100%',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-section-title">{t('sectionTopClients')}</div>
      <div className="dash-card">
        {topClients.length === 0 ? (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{t('noData')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topClients.map((c, i) => (
              <div key={`${c.name}-${i}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>
                    {c.name} <span style={{ color: '#999' }}>· {t('bookingsCount', { count: c.count })}</span>
                  </span>
                  <strong>{formatPrice(c.revenueCents)}</strong>
                </div>
                <div style={{ background: 'var(--dash-gray-100)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${maxClientRevenue > 0 ? (c.revenueCents / maxClientRevenue) * 100 : 0}%`,
                      background: '#16a34a',
                      height: '100%',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
