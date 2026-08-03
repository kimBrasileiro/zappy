import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { formatRelativeTime } from '../../../lib/format-time';
import { Avatar } from '../avatar';
import { RefreshButton } from '../refresh-button';
import { AutoRefresh } from './auto-refresh';
import { SearchInput } from './search-input';

export default async function InboxPage({ searchParams }: { searchParams: { q?: string } }) {
  const { companyId } = await requireSession();
  const [t, locale] = await Promise.all([getTranslations('dashboard.inbox'), getLocale()]);
  const query = searchParams.q?.trim();

  const tickets = await prisma.ticket.findMany({
    where: {
      companyId,
      status: { in: ['waiting_human', 'in_progress'] },
      ...(query && {
        customer: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return (
    <>
      <AutoRefresh />
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-toolbar-row">
        <SearchInput placeholder={t('searchPlaceholder')} />
      </div>

      <div className="dash-list">
        {tickets.map((ticket) => {
          const displayName = ticket.customer?.name ?? ticket.customer?.email ?? ticket.customer?.externalId ?? t('anonymous');
          const preview = ticket.messages[0]?.content ?? t('lastMessageEmpty');
          return (
            <Link key={ticket.id} href={`/dashboard/conversations/${ticket.id}`} className="dash-list-item">
              <Avatar name={displayName} seed={ticket.customerId ?? ticket.id} className="dash-list-avatar" size={38} />
              <div className="dash-list-body">
                <div className="dash-list-name-row">
                  <span className="dash-list-name">{displayName}</span>
                  <span className="dash-list-time">{formatRelativeTime(ticket.updatedAt, locale)}</span>
                </div>
                <div className="dash-list-preview">{preview}</div>
              </div>
              <div className="dash-list-meta">
                <span className="dash-channel-badge">{ticket.channel}</span>
                <span className={`dash-badge dash-badge-${ticket.status}`}>{ticket.status}</span>
              </div>
            </Link>
          );
        })}
        {tickets.length === 0 && (
          <div className="dash-list-item" style={{ color: '#999' }}>
            {query ? t('noResults') : t('noTickets')}
          </div>
        )}
      </div>
    </>
  );
}
