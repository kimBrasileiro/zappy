import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSuperAdmin } from '../../../lib/admin-auth';
import { toggleUserActive } from './actions';
import { formatDateTime } from '../../../lib/format-time';

export default async function AdminUsersPage() {
  const { userId: callerId } = await requireSuperAdmin();
  const t = await getTranslations('admin.users');
  const locale = await getLocale();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { company: true },
  });

  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">{t('subtitle')}</p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableEmail')}</th>
            <th>{t('tableName')}</th>
            <th>{t('tableCompany')}</th>
            <th>{t('tableRole')}</th>
            <th>{t('tableStatus')}</th>
            <th>{t('tableCreatedAt')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.name}</td>
              <td>{user.company?.name ?? '—'}</td>
              <td>{user.role}</td>
              <td>
                <span className={user.status === 'active' ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {user.status}
                </span>
              </td>
              <td>{formatDateTime(user.createdAt, locale)}</td>
              <td style={{ display: 'flex', gap: 6 }}>
                <Link href={`/admin/users/${user.id}`} className="dash-btn dash-btn-secondary">
                  {t('editButton')}
                </Link>
                {user.id !== callerId && (
                  <form action={toggleUserActive.bind(null, user.id)}>
                    <button type="submit" className={user.status === 'active' ? 'dash-btn dash-btn-danger' : 'dash-btn dash-btn-secondary'}>
                      {user.status === 'active' ? t('deactivateButton') : t('reactivateButton')}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: '#999' }}>
                {t('noUsers')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
