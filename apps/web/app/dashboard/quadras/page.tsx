import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { toggleCourtActive } from '../sports-actions';
import { CourtForm } from '../sports-forms';

export default async function CourtsPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.sports');

  const courts = await prisma.court.findMany({
    where: { companyId },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { classes: { where: { active: true } } } } },
  });

  return (
    <>
      <h1 className="dash-h1">{t('courtsTitle')}</h1>
      <p className="dash-subtitle">{t('courtsSubtitle')}</p>

      <div className="dash-card">
        <CourtForm />
      </div>

      {courts.length === 0 && <p style={{ color: '#999' }}>{t('noCourts')}</p>}
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>{t('courtName')}</th>
              <th>{t('activeClasses')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {courts.map((court) => (
              <tr key={court.id} style={court.active ? undefined : { opacity: 0.55 }}>
                <td>{court.name}</td>
                <td>{court._count.classes}</td>
                <td style={{ textAlign: 'right' }}>
                  <form action={toggleCourtActive.bind(null, court.id)}>
                    <button type="submit" className="dash-btn dash-btn-secondary">
                      {court.active ? t('deactivate') : t('activate')}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
