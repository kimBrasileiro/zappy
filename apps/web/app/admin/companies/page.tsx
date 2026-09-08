import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { formatDateTime } from '../../../lib/format-time';

export default async function AdminCompaniesPage() {
  const t = await getTranslations('admin.companies');
  const ta = await getTranslations('auth');
  const locale = await getLocale();
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, tickets: true } } },
  });

  const businessTypeLabels: Record<string, string> = {
    salao_beleza: ta('businessTypeSalaoBeleza'),
    barbearia: ta('businessTypeBarbearia'),
    pet_shop: ta('businessTypePetShop'),
    estetica_massagem: ta('businessTypeEsteticaMassagem'),
    outro: ta('businessTypeOutro'),
  };

  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">{t('subtitle')}</p>

      <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableName')}</th>
            <th>{t('tableSlug')}</th>
            <th>{t('tableBusinessType')}</th>
            <th>{t('tableWhatsApp')}</th>
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
              <td>{company.businessType ? (businessTypeLabels[company.businessType] ?? company.businessType) : '—'}</td>
              <td>
                {company.whatsappPhoneId ? (
                  <span className="dash-badge dash-badge-in_progress" title={company.whatsappConnectedNumber ?? undefined}>
                    {t('whatsappOwn')}
                  </span>
                ) : (
                  <span style={{ color: '#999' }}>{t('whatsappShared')}</span>
                )}
              </td>
              <td>{company.plan}</td>
              <td>
                <span className={company.status === 'active' ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {company.status}
                </span>
              </td>
              <td>{company._count.users}</td>
              <td>{company._count.tickets}</td>
              <td>{formatDateTime(company.createdAt, locale)}</td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan={9} style={{ color: '#999' }}>
                {t('noCompanies')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
