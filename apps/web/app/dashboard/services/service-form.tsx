'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { ServiceFormState } from './actions';

const initialState: ServiceFormState = {};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type BusinessHours = Record<string, [string, string] | null>;

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
  };
  submitLabel: string;
}) {
  const t = useTranslations('dashboard.services');
  const [state, formAction] = useFormState(action, initialState);
  const [is24h, setIs24h] = useState(defaultValues?.is24h ?? false);

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
        <input
          name="staffNames"
          defaultValue={defaultValues?.staffNames?.join(', ') ?? ''}
          placeholder={t('formStaffPlaceholder')}
        />
        <span style={{ fontSize: 11.5, color: '#999' }}>{t('formStaffHint')}</span>
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
