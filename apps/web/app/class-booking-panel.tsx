'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import {
  getKnownLevels,
  getPublicClassSessions,
  getPublicCourtSlots,
  submitClassEnrollment,
  submitCourtReservation,
  submitEventForm,
  type PublicSession,
} from './class-booking-actions';

const BRAND_COLOR = '#2563eb';
const SPORTS = [
  { value: 'beach_tennis', label: 'Beach Tennis' },
  { value: 'futevolei', label: 'Futevôlei' },
  { value: 'volei', label: 'Vôlei' },
];
const LEVELS = ['iniciante', 'intermediario', 'avancado'] as const;
const DURATIONS = [60, 90, 120];

type Tab = 'classes' | 'court' | 'event';
type CourtSlots = { courtName: string; slots: string[] };

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d8dce3',
  fontSize: 16, // 16px keeps iOS Safari from zooming the page on focus
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
};
const labelStyle: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6, textAlign: 'left' };
const chipStyle = (active: boolean): CSSProperties => ({
  padding: '9px 14px',
  borderRadius: 999,
  border: `1px solid ${active ? BRAND_COLOR : '#d8dce3'}`,
  background: active ? BRAND_COLOR : '#fff',
  color: active ? '#fff' : '#333',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
});
const primaryButton: CSSProperties = {
  padding: '12px 18px',
  borderRadius: 10,
  border: 'none',
  background: BRAND_COLOR,
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
};

function todayPlus(minDate: string, days: number) {
  const d = new Date(`${minDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ClassBookingPanel({
  companySlug,
  minDate,
  locale,
  currencyCode,
}: {
  companySlug: string;
  minDate: string;
  locale: string;
  currencyCode: string;
}) {
  const t = useTranslations('classBooking');
  const [tab, setTab] = useState<Tab>('classes');

  // Who is booking — shared by all three tabs. The phone is the key of the
  // student's record: typing it pre-selects levels they already told us.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [knownLevels, setKnownLevels] = useState<Record<string, string>>({});

  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: 'currency', currency: currencyCode });
  const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const errorText = (code?: string) => {
    const map: Record<string, string> = {
      class_full: 'errorFull',
      already_enrolled: 'errorAlreadyEnrolled',
      time_conflict: 'errorTimeConflict',
      invalid_customer_phone: 'errorInvalidPhone',
      invalid_contact_phone: 'errorInvalidPhone',
      missing_customer_name: 'errorMissingName',
      missing_contact_name: 'errorMissingName',
      rate_limited: 'errorRateLimited',
      slot_unavailable: 'errorSlotTaken',
    };
    return t(map[code ?? ''] ?? 'errorGeneric');
  };

  async function lookupPhone() {
    if (phone.replace(/\D/g, '').length < 10) return;
    const res = await getKnownLevels(companySlug, phone);
    if ('levels' in res && res.levels) setKnownLevels(res.levels as Record<string, string>);
  }

  const contactReady = name.trim().length > 0 && phone.replace(/\D/g, '').length >= 10;

  // --- classes tab -----------------------------------------------------------
  const [sport, setSport] = useState('');
  const [level, setLevel] = useState('');
  const [sessions, setSessions] = useState<PublicSession[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [picked, setPicked] = useState<PublicSession | null>(null);

  useEffect(() => {
    if (sport && knownLevels[sport]) setLevel((current) => current || knownLevels[sport]!);
  }, [sport, knownLevels]);

  useEffect(() => {
    if (!sport || !level) {
      setSessions(null);
      return;
    }
    let cancelled = false;
    setLoadingSessions(true);
    setPicked(null);
    void getPublicClassSessions(companySlug, { sport, level, phone }).then((res) => {
      if (cancelled) return;
      setSessions('sessions' in res && res.sessions ? res.sessions : []);
      setLoadingSessions(false);
    });
    return () => {
      cancelled = true;
    };
    // phone deliberately left out: re-listing on every keystroke is noise; the
    // level chip (pre-selected from the phone) is what drives the list.
  }, [sport, level, companySlug]);

  async function enroll() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitClassEnrollment(companySlug, {
        classId: picked.classId,
        date: picked.date,
        name,
        phone,
        email: email || undefined,
        playerLevel: level,
      });
      if ('success' in res && res.success) {
        setDone(
          t('successClass', {
            sport: res.session.sportLabel,
            day: dayLabel(res.session.date),
            time: res.session.startTime,
            court: res.session.courtName,
          }),
        );
      } else {
        setError(errorText(res.error));
      }
    } finally {
      setBusy(false);
    }
  }

  // --- court tab ---------------------------------------------------------------
  const [courtDate, setCourtDate] = useState(minDate);
  const [duration, setDuration] = useState(60);
  const [participants, setParticipants] = useState('');
  const [courts, setCourts] = useState<CourtSlots[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [courtPick, setCourtPick] = useState<{ courtName: string; time: string } | null>(null);

  useEffect(() => {
    if (tab !== 'court') return;
    let cancelled = false;
    setCourts(null);
    setCourtPick(null);
    void getPublicCourtSlots(companySlug, courtDate, duration).then((res) => {
      if (cancelled) return;
      setClosed('closed' in res && !!res.closed);
      setCourts('courts' in res && res.courts ? res.courts : []);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, courtDate, duration, companySlug]);

  async function reserve() {
    if (!courtPick) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitCourtReservation(companySlug, {
        date: courtDate,
        startTime: courtPick.time,
        durationMinutes: duration,
        courtName: courtPick.courtName,
        participants: participants ? Number(participants) : undefined,
        name,
        phone,
        email: email || undefined,
      });
      if ('success' in res && res.success) {
        setDone(t('successCourt', { court: res.courtName, day: dayLabel(res.date), time: res.startTime }));
      } else {
        setError(errorText(res.error));
      }
    } finally {
      setBusy(false);
    }
  }

  // --- event tab -----------------------------------------------------------------
  const [eventType, setEventType] = useState('empresa');
  const [eventDate, setEventDate] = useState('');
  const [eventPeople, setEventPeople] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  async function sendEvent() {
    setBusy(true);
    setError(null);
    try {
      const res = await submitEventForm(companySlug, {
        eventType,
        dateHint: eventDate || undefined,
        participants: eventPeople ? Number(eventPeople) : undefined,
        notes: eventNotes || undefined,
        name,
        phone,
        email: email || undefined,
      });
      if ('success' in res && res.success) setDone(t('successEvent'));
      else setError(errorText(res.error));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setError(null);
    setPicked(null);
    setCourtPick(null);
    setSessions(null);
    setSport('');
    setLevel('');
  }

  const card: CSSProperties = {
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: 20,
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    textAlign: 'left',
  };

  if (done) {
    return (
      <div style={{ maxWidth: 460, margin: '8px auto 0' }}>
        <div style={{ ...card, textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{t('successTitle')}</h3>
          <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px', whiteSpace: 'pre-line' }}>{done}</p>
          <button type="button" onClick={reset} style={{ ...primaryButton, background: '#eef2ff', color: BRAND_COLOR }}>
            {t('another')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: '8px auto 0' }}>
      <div style={card}>
        <div style={{ display: 'flex', gap: 6, background: '#f3f4f8', padding: 4, borderRadius: 12, marginBottom: 18 }}>
          {(['classes', 'court', 'event'] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setError(null);
              }}
              style={{
                flex: 1,
                padding: '9px 6px',
                border: 'none',
                borderRadius: 9,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: tab === k ? '#fff' : 'transparent',
                color: tab === k ? BRAND_COLOR : '#666',
                boxShadow: tab === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t(k === 'classes' ? 'tabClasses' : k === 'court' ? 'tabCourt' : 'tabEvent')}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>{t('phoneLabel')}</label>
            <input
              style={inputStyle}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={lookupPhone}
              placeholder="(11) 91234-5678"
            />
          </div>
          <div>
            <label style={labelStyle}>{t('nameLabel')}</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
          </div>
          <div>
            <label style={labelStyle}>{t('emailLabel')}</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
        </div>

        {tab === 'classes' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>{t('sportLabel')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SPORTS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    style={chipStyle(sport === s.value)}
                    onClick={() => {
                      setSport(s.value);
                      setLevel(knownLevels[s.value] ?? '');
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {sport && (
              <div>
                <label style={labelStyle}>{t('levelLabel')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {LEVELS.map((l) => (
                    <button key={l} type="button" style={chipStyle(level === l)} onClick={() => setLevel(l)}>
                      {t(`level_${l}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loadingSessions && <p style={{ color: '#777', fontSize: 13, margin: 0 }}>{t('loading')}</p>}
            {sessions && !loadingSessions && sessions.length === 0 && <p style={{ color: '#777', fontSize: 13, margin: 0 }}>{t('noSessions')}</p>}
            {sessions && sessions.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {sessions.map((s) => {
                  const active = picked?.classId === s.classId && picked.date === s.date;
                  return (
                    <button
                      key={`${s.classId}-${s.date}`}
                      type="button"
                      onClick={() => setPicked(s)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1.5px solid ${active ? BRAND_COLOR : '#e2e5ec'}`,
                        background: active ? '#f5f7ff' : '#fff',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700, fontSize: 15 }}>
                        <span>
                          {dayLabel(s.date)} · {s.startTime}–{s.endTime}
                        </span>
                        <span style={{ color: '#666', fontWeight: 600, fontSize: 13 }}>{t('seatsLeft', { n: s.seatsLeft })}</span>
                      </div>
                      <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>
                        {s.courtName} · {money(s.priceCents)} · {t('payOnSite')}
                        {s.matchesPlayerLevel && <span style={{ color: '#047857', fontWeight: 700 }}> · {t('recommended')}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {picked && (
              <button type="button" style={{ ...primaryButton, opacity: busy || !contactReady ? 0.6 : 1 }} disabled={busy || !contactReady} onClick={enroll}>
                {busy ? t('confirming') : t('confirmClass')}
              </button>
            )}
          </div>
        )}

        {tab === 'court' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ color: '#666', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{t('courtIntro')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>{t('dateLabel')}</label>
                <input style={inputStyle} type="date" min={minDate} max={todayPlus(minDate, 60)} value={courtDate} onChange={(e) => setCourtDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{t('peopleLabel')}</label>
                <input style={inputStyle} type="number" min={1} inputMode="numeric" value={participants} onChange={(e) => setParticipants(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('durationLabel')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DURATIONS.map((d) => (
                  <button key={d} type="button" style={chipStyle(duration === d)} onClick={() => setDuration(d)}>
                    {t('minutes', { n: d })}
                  </button>
                ))}
              </div>
            </div>
            {courts === null && <p style={{ color: '#777', fontSize: 13, margin: 0 }}>{t('loading')}</p>}
            {courts && closed && <p style={{ color: '#777', fontSize: 13, margin: 0 }}>{t('closedThatDay')}</p>}
            {courts && !closed && courts.every((c) => c.slots.length === 0) && <p style={{ color: '#777', fontSize: 13, margin: 0 }}>{t('noFree')}</p>}
            {courts &&
              courts
                .filter((c) => c.slots.length > 0)
                .map((c) => (
                  <div key={c.courtName}>
                    <p style={{ ...labelStyle, marginBottom: 8 }}>{c.courtName}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {c.slots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          style={chipStyle(courtPick?.courtName === c.courtName && courtPick.time === time)}
                          onClick={() => setCourtPick({ courtName: c.courtName, time })}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            {courtPick && (
              <button type="button" style={{ ...primaryButton, opacity: busy || !contactReady ? 0.6 : 1 }} disabled={busy || !contactReady} onClick={reserve}>
                {busy ? t('confirming') : t('confirmCourt', { court: courtPick.courtName, time: courtPick.time })}
              </button>
            )}
          </div>
        )}

        {tab === 'event' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ color: '#666', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{t('eventIntro')}</p>
            <div>
              <label style={labelStyle}>{t('eventTypeLabel')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(['empresa', 'aniversario', 'outro'] as const).map((k) => (
                  <button key={k} type="button" style={chipStyle(eventType === k)} onClick={() => setEventType(k)}>
                    {t(`event_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>{t('eventDateLabel')}</label>
                <input style={inputStyle} value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder={t('eventDatePlaceholder')} />
              </div>
              <div>
                <label style={labelStyle}>{t('peopleLabel')}</label>
                <input style={inputStyle} type="number" min={1} inputMode="numeric" value={eventPeople} onChange={(e) => setEventPeople(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('notesLabel')}</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} />
            </div>
            <button type="button" style={{ ...primaryButton, opacity: busy || !contactReady ? 0.6 : 1 }} disabled={busy || !contactReady} onClick={sendEvent}>
              {busy ? t('confirming') : t('sendEvent')}
            </button>
          </div>
        )}

        {error && <p style={{ color: '#b91c1c', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
      </div>
    </div>
  );
}
