import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { formatDateTime } from '../../../lib/format-time';

const BLOCK_ACTIONS = ['agent_reply.blocked_moderation', 'agent_reply.blocked_rate_limit'];

export default async function AdminModerationPage() {
  const [t, locale] = await Promise.all([getTranslations('admin.moderation'), getLocale()]);

  const logs = await prisma.auditLog.findMany({
    where: { action: { in: BLOCK_ACTIONS } },
    include: { company: true, user: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">{t('subtitle')}</p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableCompany')}</th>
            <th>{t('tableAgent')}</th>
            <th>{t('tableType')}</th>
            <th>{t('tableContent')}</th>
            <th>{t('tableCreatedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const details = log.after as { content?: string; reason?: string } | null;
            const isModeration = log.action === 'agent_reply.blocked_moderation';
            return (
              <tr key={log.id}>
                <td>{log.company?.name ?? t('unknownCompany')}</td>
                <td>{log.user?.name ?? log.user?.email ?? t('unknownAgent')}</td>
                <td>
                  <span className={`dash-badge ${isModeration ? 'dash-badge-canceled' : 'dash-badge-past_due'}`}>
                    {isModeration ? t('typeModeration') : t('typeRateLimit')}
                  </span>
                </td>
                <td style={{ maxWidth: 360 }}>{details?.content ?? '—'}</td>
                <td>{formatDateTime(log.createdAt, locale)}</td>
              </tr>
            );
          })}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: '#999' }}>
                {t('noBlocks')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
