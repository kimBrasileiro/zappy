import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { getDeploymentTimezone, toWallClock, wallClockToUtc } from '../../../lib/format-time';
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from '../../../lib/bot/services';

const DAY_MS = 24 * 60 * 60_000;
type PeriodKey = 'week' | 'month' | 'custom';

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
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

// Calendar-month/week boundaries in THIS deployment's own local time, not
// UTC — a company in São Paulo (UTC-3) filtering "este mês" on the morning
// of the 1st must not still be looking at August. Mirrors the rigor
// dayKeyOf/checkAvailability already apply elsewhere; lib/bot/quota.ts's own
// currentMonthStart() is plain-UTC and fine for a billing cutoff, not
// precise enough for a report boundary a human is reading.
function currentMonthStart(timeZone: string, now: Date): Date {
  const local = toWallClock(timeZone, now);
  return wallClockToUtc(timeZone, local.year, local.month0, 1, 0);
}

function currentWeekStart(timeZone: string, now: Date): Date {
  const local = toWallClock(timeZone, now);
  // Monday-start week (Brazilian convention) — Date.UTC's own getUTCDay()
  // (0=Sun..6=Sat) used only to count days back to Monday, not as the
  // instant itself, so it stays correct regardless of server-process locale.
  const asUtcDate = new Date(Date.UTC(local.year, local.month0, local.day));
  const dow = asUtcDate.getUTCDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(asUtcDate.getTime() - daysSinceMonday * DAY_MS);
  return wallClockToUtc(timeZone, monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0);
}

function parseCustomDate(raw: string | undefined, timeZone: string, endOfDay: boolean): Date | null {
  const match = raw ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null;
  if (!match) return null;
  const [, y, m, d] = match;
  return endOfDay
    ? wallClockToUtc(timeZone, Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999)
    : wallClockToUtc(timeZone, Number(y), Number(m) - 1, Number(d), 0);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { period?: string; from?: string; to?: string };
}) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.reports');
  const timeZone = getDeploymentTimezone();
  const now = new Date();

  const periodKey: PeriodKey =
    searchParams.period === 'week' || searchParams.period === 'custom' ? searchParams.period : 'month';

  const customFrom = parseCustomDate(searchParams.from, timeZone, false);
  const customTo = parseCustomDate(searchParams.to, timeZone, true);

  const periodStart =
    periodKey === 'custom' && customFrom
      ? customFrom
      : periodKey === 'week'
        ? currentWeekStart(timeZone, now)
        : currentMonthStart(timeZone, now);
  // A custom "to" in the future is clamped to now — can't report on
  // bookings that haven't happened yet, and an open-ended range shouldn't
  // silently include every future confirmed booking as if it were history.
  const periodEnd = periodKey === 'custom' && customTo && customTo < now ? customTo : now;

  const [bookings, newClientsCount, company] = await Promise.all([
    prisma.booking.findMany({
      where: { companyId, scheduledAt: { gte: periodStart, lte: periodEnd } },
      include: { service: { select: { name: true } }, customer: { select: { name: true, email: true, externalId: true } } },
    }),
    prisma.customer.count({ where: { companyId, createdAt: { gte: periodStart, lte: periodEnd } } }),
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
  const byStaff = new Map<string, { name: string; count: number; revenueCents: number; minutes: number }>();
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

    if (b.staffName) {
      const st = byStaff.get(b.staffName) ?? { name: b.staffName, count: 0, revenueCents: 0, minutes: 0 };
      st.count += 1;
      st.revenueCents += b.priceCents;
      st.minutes += b.durationMinutes;
      byStaff.set(b.staffName, st);
    }
  }
  const allServices = [...byService.values()].sort((a, b) => b.revenueCents - a.revenueCents);
  const allClients = [...byClient.values()].sort((a, b) => b.revenueCents - a.revenueCents);
  const allStaff = [...byStaff.values()].sort((a, b) => b.revenueCents - a.revenueCents);
  const maxServiceRevenue = allServices[0]?.revenueCents ?? 0;

  // Occupancy — an estimate, not a real capacity model: it treats the
  // business as a single resource (this deployment has no per-staff-member
  // parallel-capacity concept to sum over), comparing booked minutes against
  // the company's own configured open hours for each day in the period. See
  // lib/bot/services.ts#getBusinessHours for the same fallback-to-default
  // logic the bot itself uses for availability.
  const businessHours = ((company?.config as { businessHours?: BusinessHours } | null)?.businessHours) ?? DEFAULT_BUSINESS_HOURS;
  let availableMinutes = 0;
  for (let d = new Date(periodStart); d <= periodEnd; d = new Date(d.getTime() + DAY_MS)) {
    const hours = businessHours[dayKeyOf(d, timeZone)];
    if (hours) availableMinutes += minutesBetween(hours[0], hours[1]);
  }
  const bookedMinutes = bookings
    .filter((b) => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => sum + b.durationMinutes, 0);
  const occupancyRate = availableMinutes > 0 ? Math.min(1, bookedMinutes / availableMinutes) : null;

  const periodLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone }).format(periodStart)
    + ' – ' + new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone }).format(periodEnd);
  const fromValue = searchParams.from ?? new Intl.DateTimeFormat('en-CA', { timeZone }).format(periodStart);
  const toValue = searchParams.to ?? new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')} · {periodLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/dashboard/reports?period=week" className={periodKey === 'week' ? 'dash-btn' : 'dash-btn dash-btn-secondary'}>
            {t('periodWeek')}
          </Link>
          <Link href="/dashboard/reports?period=month" className={periodKey === 'month' ? 'dash-btn' : 'dash-btn dash-btn-secondary'}>
            {t('periodMonth')}
          </Link>
        </div>
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 13.5, margin: '0 0 10px' }}>{t('periodCustomTitle')}</h3>
        <form action="/dashboard/reports" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="hidden" name="period" value="custom" />
          <div className="dash-form-row" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11.5 }}>{t('periodFromLabel')}</label>
            <input type="date" name="from" defaultValue={fromValue} required />
          </div>
          <div className="dash-form-row" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11.5 }}>{t('periodToLabel')}</label>
            <input type="date" name="to" defaultValue={toValue} required />
          </div>
          <button type="submit" className={periodKey === 'custom' ? 'dash-btn' : 'dash-btn dash-btn-secondary'}>
            {t('periodApplyButton')}
          </button>
        </form>
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

      {allStaff.length > 0 && (
        <>
          <div className="dash-section-title">{t('sectionByStaff')}</div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t('tableStaffName')}</th>
                  <th>{t('tableStaffBookings')}</th>
                  <th>{t('tableStaffHours')}</th>
                  <th>{t('tableStaffRevenue')}</th>
                </tr>
              </thead>
              <tbody>
                {allStaff.map((st) => (
                  <tr key={st.name}>
                    <td>{st.name}</td>
                    <td>{st.count}</td>
                    <td>{formatHours(st.minutes)}</td>
                    <td>{formatPrice(st.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="dash-section-title">{t('sectionTopServices')}</div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>{t('tableServiceName')}</th>
              <th>{t('tableStaffBookings')}</th>
              <th>{t('tableStaffRevenue')}</th>
            </tr>
          </thead>
          <tbody>
            {allServices.map((s) => (
              <tr key={s.name}>
                <td style={{ width: '50%' }}>
                  <div style={{ marginBottom: 4 }}>{s.name}</div>
                  <div style={{ background: 'var(--dash-gray-100)', borderRadius: 999, height: 6, overflow: 'hidden', maxWidth: 220 }}>
                    <div
                      style={{
                        width: `${maxServiceRevenue > 0 ? (s.revenueCents / maxServiceRevenue) * 100 : 0}%`,
                        background: 'var(--dash-brand)',
                        height: '100%',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </td>
                <td>{s.count}</td>
                <td>{formatPrice(s.revenueCents)}</td>
              </tr>
            ))}
            {allServices.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: '#999' }}>
                  {t('noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="dash-section-title">{t('sectionTopClients')}</div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>{t('tableClientName')}</th>
              <th>{t('tableStaffBookings')}</th>
              <th>{t('tableStaffRevenue')}</th>
            </tr>
          </thead>
          <tbody>
            {allClients.map((c, i) => (
              <tr key={`${c.name}-${i}`}>
                <td>{c.name}</td>
                <td>{c.count}</td>
                <td>{formatPrice(c.revenueCents)}</td>
              </tr>
            ))}
            {allClients.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: '#999' }}>
                  {t('noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
