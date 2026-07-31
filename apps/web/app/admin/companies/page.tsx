import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';

export default async function AdminCompaniesPage() {
  const t = await getTranslations('admin.companies');
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, tickets: true } } },
  });

  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">{t('subtitle')}</p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableName')}</th>
            <th>{t('tableSlug')}</th>
            <th>{t('tablePlan')}</th>
            <th>{t('tableStatus')}</th>
            <th>{t('tableUsers')}</th>
            <th>{t('tableTickets')}</th>
            <th>{t('tableCreatedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id}>
              <td>{company.name}</td>
              <td>{company.slug}</td>
              <td>{company.plan}</td>
              <td>
                <span className={company.status === 'active' ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {company.status}
                </span>
              </td>
              <td>{company._count.users}</td>
              <td>{company._count.tickets}</td>
              <td>{company.createdAt.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: '#999' }}>
                {t('noCompanies')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
