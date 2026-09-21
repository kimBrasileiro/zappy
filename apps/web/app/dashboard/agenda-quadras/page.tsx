import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '../../../lib/auth-server';
import { getDayAgenda } from '../../../lib/sports/admin';
import { addDaysIso, parseIsoDate, timeToMinutes, todayIso, weekdayOf } from '../../../lib/sports/classes';
import { LEVEL_LABELS, SPORT_LABELS, isLevel, isSport } from '../../../lib/sports/constants';
import { cancelClassSession, cancelCourtReservation, markEnrollment, openClassFromAgenda, restoreClassSession } from '../sports-actions';
import { RefreshButton } from '../refresh-button';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

type PageProps = { searchParams: { date?: string } };

export default async function CourtAgendaPage({ searchParams }: PageProps) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.sports');

  const today = todayIso();
  const date = searchParams.date && parseIsoDate(searchParams.date) ? searchParams.date : today;
  const { courts, closed } = await getDayAgenda(companyId, date);

  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const navLink = (to: string, text: string) => (
    <Link className="dash-btn dash-btn-secondary" href={`/dashboard/agenda-quadras?date=${to}`}>
      {text}
    </Link>
  );

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('agendaTitle')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('agendaSubtitle')}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 16px' }}>
        {navLink(addDaysIso(date, -1), '‹')}
        <strong style={{ minWidth: 150, textAlign: 'center' }}>
          {t(`weekday_${WEEKDAY_KEYS[weekdayOf(date)]}`)} · {label}
        </strong>
        {navLink(addDaysIso(date, 1), '›')}
        {date !== today && navLink(today, t('today'))}
      </div>

      {closed && <p style={{ color: '#999' }}>{t('closedThatDay')}</p>}
      {courts.length === 0 && <p style={{ color: '#999' }}>{t('needCourtFirst')}</p>}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', alignItems: 'start' }}>
        {courts.map((court) => (
          <div key={court.courtId} className="dash-card" style={{ padding: 14 }}>
            <div className="dash-section-title" style={{ marginTop: 0 }}>
              {court.courtName}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {court.items.length === 0 && <p style={{ color: '#999', margin: 0 }}>{t('nothingToday')}</p>}
              {court.items.map((item) => {
                if (item.kind === 'free') {
                  const canOpen = timeToMinutes(item.endTime) - timeToMinutes(item.startTime) >= 60;
                  return (
                    <div key={`free-${item.startTime}`} style={{ border: '1px dashed #cbd5e1', borderRadius: 12, padding: '10px 12px', background: '#f8fafc' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {item.startTime}–{item.endTime} <span style={{ color: '#047857', fontWeight: 600 }}>· {t('free')}</span>
                      </div>
                      {canOpen && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: 13, fontWeight: 600 }}>{t('openClassHere')}</summary>
                          <form action={openClassFromAgenda} style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="courtId" value={court.courtId} />
                            <input type="hidden" name="durationMinutes" value="60" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <select name="sport" aria-label={t('sport')}>
                                {Object.entries(SPORT_LABELS).map(([value, text]) => (
                                  <option key={value} value={value}>
                                    {text}
                                  </option>
                                ))}
                              </select>
                              <select name="level" aria-label={t('level')}>
                                {Object.entries(LEVEL_LABELS).map(([value, text]) => (
                                  <option key={value} value={value}>
                                    {text}
                                  </option>
                                ))}
                              </select>
                              <input name="startTime" type="time" defaultValue={item.startTime} min={item.startTime} aria-label={t('startTime')} />
                              <input name="capacity" type="number" min={1} defaultValue={8} aria-label={t('capacity')} />
                            </div>
                            <input name="price" inputMode="decimal" defaultValue="60" aria-label={t('price')} />
                            <button type="submit" className="dash-btn">
                              {t('openClassButton')}
                            </button>
                            <span style={{ color: '#888', fontSize: 12 }}>{t('openClassHint', { weekday: t(`weekdayFull_${WEEKDAY_KEYS[weekdayOf(date)]}`) })}</span>
                          </form>
                        </details>
                      )}
                    </div>
                  );
                }

                if (item.kind === 'reservation') {
                  return (
                    <div key={`res-${item.reservationId}`} style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {item.startTime}–{item.endTime} · {t('groupReservation')}
                      </div>
                      <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
                        {item.customerName}
                        {item.customerPhone ? ` · ${item.customerPhone}` : ''}
                        {item.participants ? ` · ${t('people', { n: item.participants })}` : ''}
                      </div>
                      <form action={cancelCourtReservation.bind(null, item.reservationId)} style={{ marginTop: 8 }}>
                        <button type="submit" className="dash-btn dash-btn-danger">
                          {t('cancelReservation')}
                        </button>
                      </form>
                    </div>
                  );
                }

                const confirmed = item.enrollments.filter((e) => e.status !== 'cancelled').length;
                return (
                  <div
                    key={`cls-${item.classId}`}
                    style={{ border: '1px solid #bfdbfe', background: item.cancelled ? '#f3f4f6' : '#eff6ff', borderRadius: 12, padding: '10px 12px', opacity: item.cancelled ? 0.7 : 1 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700, fontSize: 14 }}>
                      <span>
                        {item.startTime}–{item.endTime} · {isSport(item.sport) ? SPORT_LABELS[item.sport] : item.sport}
                      </span>
                      <span style={{ color: '#1d4ed8' }}>
                        {confirmed}/{item.capacity}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
                      {isLevel(item.level) ? LEVEL_LABELS[item.level] : item.level}
                      {item.instructorName ? ` · ${item.instructorName}` : ''}
                      {item.cancelled ? ` · ${t('sessionCancelled')}` : ''}
                    </div>
                    {item.enrollments.length > 0 && (
                      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6 }}>
                        {item.enrollments.map((e) => (
                          <li key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', fontSize: 13 }}>
                            <span>
                              {e.customerName}
                              {e.customerPhone ? <span style={{ color: '#888' }}> · {e.customerPhone}</span> : null}
                            </span>
                            <span style={{ display: 'flex', gap: 4 }}>
                              <form action={markEnrollment.bind(null, e.id, e.status === 'attended' ? 'confirmed' : 'attended')}>
                                <button type="submit" className={e.status === 'attended' ? 'dash-btn' : 'dash-btn dash-btn-secondary'} title={t('attended')}>
                                  ✓
                                </button>
                              </form>
                              <form action={markEnrollment.bind(null, e.id, e.status === 'no_show' ? 'confirmed' : 'no_show')}>
                                <button type="submit" className={e.status === 'no_show' ? 'dash-btn dash-btn-danger' : 'dash-btn dash-btn-secondary'} title={t('noShow')}>
                                  ✗
                                </button>
                              </form>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form
                      action={item.cancelled ? restoreClassSession.bind(null, item.classId, date) : cancelClassSession.bind(null, item.classId, date)}
                      style={{ marginTop: 8 }}
                    >
                      <button type="submit" className={item.cancelled ? 'dash-btn dash-btn-secondary' : 'dash-btn dash-btn-danger'}>
                        {item.cancelled ? t('restoreSession') : t('cancelSession')}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
