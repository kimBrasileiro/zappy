'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { ServiceFormState } from './actions';

const initialState: ServiceFormState = {};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type BusinessHours = Record<string, [string, string] | null>;

// Every service has at least one row — staff is mandatory (a service is
// really a person's own agenda, not an abstract slot; see
// lib/bot/services.ts#resolveStaffDuration). `duration` empty means "use
// this service's own base duration" — only set when this specific person
// genuinely takes a different amount of time than everyone else.
type StaffRow = { name: string; duration: string };

function SubmitButton({ label }: { label: string }) {
  const t = useTranslations('dashboard.services');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? t('saving') : label}
    </button>
  );
}

export function ServiceForm({
  action,
  defaultValues,
  // Names already used by this company's OTHER services — offered as
  // autocomplete suggestions (via <datalist>) so the same person typed once
  // for "Corte" shows up as a pick for "Barba" too, instead of every service
  // re-typing (and risking a typo that silently creates a second, unrelated
  // "person" as far as conflict-checking is concerned).
  existingStaffNames = [],
  submitLabel,
}: {
  action: (prevState: ServiceFormState, formData: FormData) => Promise<ServiceFormState>;
  defaultValues?: {
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    bookingMode: string;
    businessHours: BusinessHours | null;
    is24h: boolean;
    cancellationNoticeHours: number;
    cancellationFeeCents: number;
    staffNames: string[];
    staffDurations?: Record<string, number>;
  };
  existingStaffNames?: string[];
  submitLabel: string;
}) {
  const t = useTranslations('dashboard.services');
  const [state, formAction] = useFormState(action, initialState);
  const [is24h, setIs24h] = useState(defaultValues?.is24h ?? false);
  const [staffRows, setStaffRows] = useState<StaffRow[]>(() =>
    defaultValues?.staffNames?.length
      ? defaultValues.staffNames.map((name) => ({
          name,
          duration: defaultValues.staffDurations?.[name] ? String(defaultValues.staffDurations[name]) : '',
        }))
      : [{ name: '', duration: '' }],
  );

  function updateStaffRow(idx: number, patch: Partial<StaffRow>) {
    setStaffRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addStaffRow() {
    setStaffRows((rows) => [...rows, { name: '', duration: '' }]);
  }
  function removeStaffRow(idx: number) {
    setStaffRows((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows));
  }

  const durationIsHours = !!defaultValues && defaultValues.durationMinutes % 60 === 0 && defaultValues.durationMinutes >= 60;
  const durationValue = defaultValues
    ? durationIsHours
      ? defaultValues.durationMinutes / 60
      : defaultValues.durationMinutes
    : undefined;
  const priceValue = defaultValues ? (defaultValues.priceCents / 100).toFixed(2) : undefined;
  const hasCustomHours = !!defaultValues?.businessHours;
  const cancellationFeeValue = defaultValues ? (defaultValues.cancellationFeeCents / 100).toFixed(2) : '0.00';

  const dayLabel: Record<(typeof DAY_KEYS)[number], string> = {
    mon: t('dayMon'),
    tue: t('dayTue'),
    wed: t('dayWed'),
    thu: t('dayThu'),
    fri: t('dayFri'),
    sat: t('daySat'),
    sun: t('daySun'),
  };

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>{t('formNameLabel')}</label>
        <input name="name" required defaultValue={defaultValues?.name} placeholder={t('formNamePlaceholder')} />
      </div>
      <div className="dash-form-row">
        <label>{t('formDescriptionLabel')}</label>
        <textarea name="description" rows={2} defaultValue={defaultValues?.description ?? ''} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="dash-form-row" style={{ flex: 1 }}>
          <label>{t('formDurationLabel')}</label>
          <input name="durationValue" type="number" min={1} step="1" required defaultValue={durationValue} />
        </div>
        <div className="dash-form-row" style={{ width: 120 }}>
          <label>{t('formDurationUnitLabel')}</label>
          <select name="durationUnit" defaultValue={durationIsHours ? 'hours' : 'minutes'}>
            <option value="minutes">{t('unitMinutes')}</option>
            <option value="hours">{t('unitHours')}</option>
          </select>
        </div>
      </div>
      <div className="dash-form-row">
        <label>{t('formPriceLabel')}</label>
        <input name="price" type="number" min={0} step="0.01" required defaultValue={priceValue} placeholder="50.00" />
      </div>

      <div className="dash-form-row">
        <label>{t('formStaffLabel')}</label>
        <p style={{ fontSize: 11.5, color: '#999', margin: '0 0 8px' }}>{t('formStaffHint')}</p>
        <datalist id="known-staff-names">
          {existingStaffNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {staffRows.map((row, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input
              name={`staffName_${idx}`}
              list="known-staff-names"
              required
              value={row.name}
              onChange={(e) => updateStaffRow(idx, { name: e.target.value })}
              placeholder={t('formStaffNamePlaceholder')}
              style={{ flex: 1 }}
            />
            <input
              name={`staffDuration_${idx}`}
              type="number"
              min={1}
              step="1"
              value={row.duration}
              onChange={(e) => updateStaffRow(idx, { duration: e.target.value })}
              placeholder={t('formStaffDurationPlaceholder')}
              style={{ width: 96 }}
            />
            <button
              type="button"
              onClick={() => removeStaffRow(idx)}
              disabled={staffRows.length === 1}
              className="dash-btn dash-btn-secondary"
              style={{ padding: '4px 10px', flexShrink: 0 }}
            >
              {t('formStaffRemove')}
            </button>
          </div>
        ))}
        <button type="button" onClick={addStaffRow} className="dash-btn dash-btn-secondary" style={{ marginTop: 2 }}>
          {t('formStaffAdd')}
        </button>
      </div>

      <div className="dash-form-row">
        <label>{t('formBookingModeLabel')}</label>
        <select name="bookingMode" defaultValue={defaultValues?.bookingMode ?? 'auto'}>
          <option value="auto">{t('bookingModeAutoOption')}</option>
          <option value="manual">{t('bookingModeManualOption')}</option>
        </select>
      </div>

      <div className="dash-form-row">
        <label>
          <input
            type="checkbox"
            name="is24h"
            checked={is24h}
            onChange={(e) => setIs24h(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          {t('is24hLabel')}
        </label>
      </div>

      {!is24h && (
        <div className="dash-form-row">
          <label>
            <input type="checkbox" name="useCustomHours" defaultChecked={hasCustomHours} style={{ marginRight: 6 }} />
            {t('customHoursLabel')}
          </label>
        </div>
      )}

      <div style={{ display: is24h ? 'none' : 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {DAY_KEYS.map((key) => {
          const dayHours = defaultValues?.businessHours?.[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 80 }}>{dayLabel[key]}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" name={`hours_${key}_closed`} defaultChecked={dayHours === null && !!defaultValues?.businessHours} />
                {t('dayClosedLabel')}
              </label>
              <input
                type="time"
                name={`hours_${key}_open`}
                defaultValue={dayHours ? dayHours[0] : '09:00'}
                style={{ padding: '4px 6px' }}
              />
              <span>{t('daySeparator')}</span>
              <input
                type="time"
                name={`hours_${key}_close`}
                defaultValue={dayHours ? dayHours[1] : '18:00'}
                style={{ padding: '4px 6px' }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 20,
          marginBottom: 20,
          padding: 16,
          background: '#f8f9fb',
          borderRadius: 10,
          border: '1px solid #eee',
        }}
      >
        <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>{t('cancellationPolicyTitle')}</h3>
        <p style={{ fontSize: 12, color: '#777', margin: '0 0 14px', lineHeight: 1.5 }}>
          {t('cancellationPolicyBody')}
        </p>
        <div className="dash-form-row">
          <label>{t('cancellationNoticeLabel')}</label>
          <select name="cancellationNoticeHours" defaultValue={String(defaultValues?.cancellationNoticeHours ?? 0)}>
            <option value="0">{t('cancellationNoticeOption0')}</option>
            <option value="2">{t('cancellationNoticeOption2')}</option>
            <option value="12">{t('cancellationNoticeOption12')}</option>
            <option value="24">{t('cancellationNoticeOption24')}</option>
            <option value="48">{t('cancellationNoticeOption48')}</option>
          </select>
        </div>
        <div className="dash-form-row">
          <label>{t('cancellationFeeLabel')}</label>
          <input
            name="cancellationFee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={cancellationFeeValue}
            placeholder="0.00"
          />
          <span style={{ fontSize: 11.5, color: '#999' }}>{t('cancellationFeeHint')}</span>
        </div>
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
