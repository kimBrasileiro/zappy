'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { createClass, createCourt, type SportsFormState } from './sports-actions';

const initialState: SportsFormState = {};

const SPORT_OPTIONS = [
  { value: 'beach_tennis', label: 'Beach Tennis' },
  { value: 'futevolei', label: 'Futevôlei' },
  { value: 'volei', label: 'Vôlei' },
];
const LEVEL_OPTIONS = ['iniciante', 'intermediario', 'avancado'] as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {label}
    </button>
  );
}

export function CourtForm() {
  const t = useTranslations('dashboard.sports');
  const [state, formAction] = useFormState(createCourt, initialState);
  return (
    <form action={formAction} className="dash-form-row" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 200px' }}>
        <label htmlFor="court-name">{t('courtName')}</label>
        <input id="court-name" name="name" placeholder={t('courtNamePlaceholder')} required />
      </div>
      <SubmitButton label={t('addCourt')} />
      {state.error && <p className="dash-form-error" style={{ flexBasis: '100%' }}>{t(`error_${state.error}`)}</p>}
    </form>
  );
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function ClassForm({ courts }: { courts: { id: string; name: string }[] }) {
  const t = useTranslations('dashboard.sports');
  const [state, formAction] = useFormState(createClass, initialState);
  return (
    <form action={formAction} className="dash-form-row" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}>
      <div>
        <label htmlFor="cls-court">{t('court')}</label>
        <select id="cls-court" name="courtId" required>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cls-weekday">{t('weekday')}</label>
        <select id="cls-weekday" name="weekday" defaultValue="1">
          {WEEKDAY_KEYS.map((k, i) => (
            <option key={k} value={i}>
              {t(`weekday_${k}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cls-time">{t('startTime')}</label>
        <input id="cls-time" name="startTime" type="time" defaultValue="18:00" required />
      </div>
      <div>
        <label htmlFor="cls-duration">{t('durationMinutes')}</label>
        <input id="cls-duration" name="durationMinutes" type="number" min={15} step={15} defaultValue={60} required />
      </div>
      <div>
        <label htmlFor="cls-sport">{t('sport')}</label>
        <select id="cls-sport" name="sport">
          {SPORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cls-level">{t('level')}</label>
        <select id="cls-level" name="level">
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {t(`level_${l}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cls-capacity">{t('capacity')}</label>
        <input id="cls-capacity" name="capacity" type="number" min={1} defaultValue={8} required />
      </div>
      <div>
        <label htmlFor="cls-price">{t('price')}</label>
        <input id="cls-price" name="price" inputMode="decimal" defaultValue="60" required />
      </div>
      <div>
        <label htmlFor="cls-instructor">{t('instructor')}</label>
        <input id="cls-instructor" name="instructorName" />
      </div>
      <SubmitButton label={t('addClass')} />
      {state.error && <p className="dash-form-error" style={{ gridColumn: '1 / -1' }}>{t(`error_${state.error}`)}</p>}
    </form>
  );
}
