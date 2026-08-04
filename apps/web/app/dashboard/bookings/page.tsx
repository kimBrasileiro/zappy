import { getLocale, getTranslations } from 'next-intl/server';
import { prisma, type Prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { RefreshButton } from '../refresh-button';
import { BookingsView } from './bookings-view';
import { getDeploymentTimezone, wallClockToUtc } from '../../../lib/format-time';

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { q?: string; date?: string };
}) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.bookings');
  const locale = await getLocale();
  const timeZone = getDeploymentTimezone();
  const q = searchParams.q?.trim();
  const date = searchParams.date?.trim();

  const where: Prisma.BookingWhereInput = { companyId };

  if (q) {
    // Same free-text field searches both name and phone — the customer
    // record is already resolved by the time a booking exists, so this is
    // just an OR across the two fields most people would actually type.
    where.customer = { is: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } };
  }

  if (date) {
    // scheduledAt is deployment-local wall-clock anchored (see
    // lib/format-time.ts and BookingsView's formatScheduledAt) — the date
    // filter matches that same convention, not the server or browser's
    // local timezone.
    const [year, month, day] = date.split('-').map(Number);
    if (year && month && day) {
      const dayStart = wallClockToUtc(timeZone, year, month - 1, day, 0, 0);
      const dayEnd = wallClockToUtc(timeZone, year, month - 1, day, 23, 59, 59, 999);
      where.scheduledAt = { gte: dayStart, lte: dayEnd };
    }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { service: true, customer: true },
    orderBy: { scheduledAt: 'desc' },
    take: 200,
  });

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

      <form method="get" className="dash-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '16px 20px', marginBottom: 20 }}>
        <label className="dash-form-row" style={{ flex: 1, marginBottom: 0 }}>
          {t('searchLabel')}
          <input type="text" name="q" defaultValue={q} placeholder={t('searchPlaceholder')} />
        </label>
        <label className="dash-form-row" style={{ marginBottom: 0 }}>
          {t('dateLabel')}
          <input type="date" name="date" defaultValue={date} />
        </label>
        <button type="submit" className="dash-btn">
          {t('searchButton')}
        </button>
        {(q || date) && (
          <a href="/dashboard/bookings" className="dash-btn dash-btn-secondary" style={{ textDecoration: 'none' }}>
            {t('clearButton')}
          </a>
        )}
      </form>

      <BookingsView
        bookings={bookings}
        emptyLabel={q || date ? t('emptyFiltered') : t('emptyDefault')}
        locale={locale}
        timeZone={timeZone}
      />
    </>
  );
}
