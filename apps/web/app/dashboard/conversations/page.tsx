import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { RefreshButton } from '../refresh-button';
import { formatDateTime } from '../../../lib/format-time';

export default async function ConversationsPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.conversations');
  const locale = await getLocale();

  const tickets = await prisma.ticket.findMany({
    where: { companyId },
    include: { customer: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
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

      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableCustomer')}</th>
            <th>{t('tableChannel')}</th>
            <th>{t('tableStatus')}</th>
            <th>{t('tablePriority')}</th>
            <th>{t('tableUpdatedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
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
              <td>{ticket.priority}</td>
              <td>{formatDateTime(ticket.updatedAt, locale)}</td>
            </tr>
          ))}
          {tickets.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: '#999' }}>
                {t('noTickets')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
