import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { LEVEL_LABELS, SPORT_LABELS, isLevel, isSport } from '../../../lib/sports/constants';
import { addMinutesToTime } from '../../../lib/sports/classes';
import { deleteClass, toggleClassActive } from '../sports-actions';
import { ClassForm } from '../sports-forms';

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default async function ClassGridPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.sports');

  const [courts, classes] = await Promise.all([
    prisma.court.findMany({ where: { companyId, active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.sportClass.findMany({
      where: { companyId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      include: { court: { select: { name: true } }, _count: { select: { enrollments: true } } },
    }),
  ]);

  const price = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <h1 className="dash-h1">{t('classesTitle')}</h1>
      <p className="dash-subtitle">{t('classesSubtitle')}</p>

      {courts.length === 0 ? (
        <p style={{ color: '#999' }}>{t('needCourtFirst')}</p>
      ) : (
        <div className="dash-card">
          <ClassForm courts={courts.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      )}

      {WEEKDAY_ORDER.map((weekday) => {
        const rows = classes.filter((c) => c.weekday === weekday);
        if (rows.length === 0) return null;
        return (
          <div key={weekday}>
            <div className="dash-section-title">{t(`weekdayFull_${WEEKDAY_KEYS[weekday]}`)}</div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>{t('time')}</th>
                    <th>{t('court')}</th>
                    <th>{t('class')}</th>
                    <th>{t('capacity')}</th>
                    <th>{t('price')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} style={c.active ? undefined : { opacity: 0.5 }}>
                      <td>
                        {c.startTime}–{addMinutesToTime(c.startTime, c.durationMinutes)}
                      </td>
                      <td>{c.court.name}</td>
                      <td>
                        {isSport(c.sport) ? SPORT_LABELS[c.sport] : c.sport} · {isLevel(c.level) ? LEVEL_LABELS[c.level] : c.level}
                        {c.instructorName && <div style={{ color: '#888', fontSize: 12 }}>{c.instructorName}</div>}
                      </td>
                      <td>{c.capacity}</td>
                      <td>{price(c.priceCents)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <form action={toggleClassActive.bind(null, c.id)} style={{ display: 'inline' }}>
                          <button type="submit" className="dash-btn dash-btn-secondary">
                            {c.active ? t('pause') : t('resume')}
                          </button>
                        </form>{' '}
                        <form action={deleteClass.bind(null, c.id)} style={{ display: 'inline' }}>
                          <button type="submit" className="dash-btn dash-btn-danger">
                            {t('remove')}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
