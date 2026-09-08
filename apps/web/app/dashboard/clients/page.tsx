import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { formatDate } from '../../../lib/format-time';

// Recorrente: 2+ completed visits — same threshold agende-me and most
// booking CRMs use for "returning client" badges. Purely a display label,
// not stored anywhere (see customer.prisma's comment on why this stays
// computed rather than a maintained column).
const RECURRING_THRESHOLD = 2;

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function ClientsPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.clients');
  const locale = await getLocale();

  const customers = await prisma.customer.findMany({
    where: { companyId, gdprDeletedAt: null },
    include: {
      bookings: { select: { status: true, priceCents: true, scheduledAt: true } },
    },
    take: 300,
  });

  const rows = customers
    .map((customer) => {
      const completed = customer.bookings.filter((b) => b.status === 'completed');
      const totalSpentCents = completed.reduce((sum, b) => sum + b.priceCents, 0);
      const lastVisit = customer.bookings.reduce<Date | null>((latest, b) => {
        if (b.status !== 'completed' && b.status !== 'confirmed') return latest;
        return !latest || b.scheduledAt > latest ? b.scheduledAt : latest;
      }, null);
      return {
        id: customer.id,
        name: customer.name ?? customer.email ?? customer.externalId ?? t('anonymous'),
        phone: customer.phone,
        bookingCount: customer.bookings.length,
        completedCount: completed.length,
        totalSpentCents,
        lastVisit,
        isRecurring: completed.length >= RECURRING_THRESHOLD,
      };
    })
    .sort((a, b) => (b.lastVisit?.getTime() ?? 0) - (a.lastVisit?.getTime() ?? 0));

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>{t('tableName')}</th>
              <th>{t('tablePhone')}</th>
              <th>{t('tableVisits')}</th>
              <th>{t('tableTotalSpent')}</th>
              <th>{t('tableLastVisit')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/dashboard/clients/${row.id}`}>
                    {row.name}
                    {row.isRecurring && (
                      <span className="dash-badge dash-badge-active" style={{ marginLeft: 8 }}>
                        {t('recurringBadge')}
                      </span>
                    )}
                  </Link>
                </td>
                <td>{row.phone ?? '—'}</td>
                <td>{row.completedCount}</td>
                <td>{formatPrice(row.totalSpentCents)}</td>
                <td>{row.lastVisit ? formatDate(row.lastVisit, locale) : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: '#999' }}>
                  {t('noClients')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
