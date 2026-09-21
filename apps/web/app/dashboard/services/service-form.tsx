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
// genuinely takes a different amount of time than everyone else. `isNew`
// toggles the row between picking an existing person from the dropdown and
// typing a brand-new name — see the NEW_STAFF_VALUE sentinel below.
type StaffRow = { name: string; duration: string; isNew: boolean };

// Not a real name (staff names are user-typed free text — see
// dashboard/services/actions.ts#parseStaffRows — so any sentinel risks
// colliding with a real one; this string never appears in a <select> built
// from real names, only as the one hardcoded "add new" option's value).
const NEW_STAFF_VALUE = '__new__';

// A variant row is entirely optional (unlike staff, which is mandatory) —
// a service with zero rows behaves exactly as before this existed. Price/
// duration are kept as strings while editing (same reasoning as the base
// price/duration fields below), parsed server-side in actions.ts.
type VariantRow = { label: string; price: string; duration: string };

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
  // Same autocomplete spirit as existingStaffNames — every category already
  // typed by this company's OTHER services, offered via <datalist> so
  // "Cabelo" typed once for one service is easy to reuse for the next
  // instead of drifting into "Cabelo"/"cabelo"/"Cabelos" as separate groups.
  existingCategories = [],
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
    category?: string | null;
    photoUrl?: string | null;
    variants?: { label: string; priceCents: number; durationMinutes: number }[];
  };
  existingStaffNames?: string[];
  existingCategories?: string[];
  submitLabel: string;
}) {
  const t = useTranslations('dashboard.services');
  const [state, formAction] = useFormState(action, initialState);
  const [is24h, setIs24h] = useState(defaultValues?.is24h ?? false);
  // A row starts in "new name" mode only when there's genuinely nothing to
  // pick from yet — otherwise it starts on the dropdown, sentinel-selected
  // (forces an explicit choice rather than silently defaulting to whichever
  // name happens to sort first).
  const newRow = (): StaffRow => ({ name: '', duration: '', isNew: existingStaffNames.length === 0 });

  const [staffRows, setStaffRows] = useState<StaffRow[]>(() =>
    defaultValues?.staffNames?.length
      ? defaultValues.staffNames.map((name) => ({
          name,
          duration: defaultValues.staffDurations?.[name] ? String(defaultValues.staffDurations[name]) : '',
          // This service's OWN current names are deliberately excluded from
          // existingStaffNames (see the two page.tsx callers) so editing
          // doesn't offer "this same service" as if it were a different
          // person — the dropdown re-adds each row's own name as an option
          // below, but a name unique to this service still isn't anywhere
          // else in the company, so there's nothing meaningful to "pick"
          // instead of it — starts in free-text mode in that case.
          isNew: !existingStaffNames.includes(name),
        }))
      : [newRow()],
  );

  function updateStaffRow(idx: number, patch: Partial<StaffRow>) {
    setStaffRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addStaffRow() {
    setStaffRows((rows) => [...rows, newRow()]);
  }
  function removeStaffRow(idx: number) {
    setStaffRows((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows));
  }

  const [variantRows, setVariantRows] = useState<VariantRow[]>(
    () =>
      defaultValues?.variants?.map((v) => ({
        label: v.label,
        price: (v.priceCents / 100).toFixed(2),
        duration: String(v.durationMinutes),
      })) ?? [],
  );
  function updateVariantRow(idx: number, patch: Partial<VariantRow>) {
    setVariantRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addVariantRow() {
    setVariantRows((rows) => [...rows, { label: '', price: '', duration: '' }]);
  }
  function removeVariantRow(idx: number) {
    setVariantRows((rows) => rows.filter((_, i) => i !== idx));
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
      <div className="dash-form-row">
        <label>{t('formCategoryLabel')}</label>
        <input
          name="category"
          list="category-suggestions"
          defaultValue={defaultValues?.category ?? ''}
          placeholder={t('formCategoryPlaceholder')}
        />
        <datalist id="category-suggestions">
          {existingCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="dash-form-row">
        <label>{t('formPhotoLabel')}</label>
        {defaultValues?.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded GCS URL, not a static/optimizable local asset
          <img
            src={defaultValues.photoUrl}
            alt=""
            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }}
          />
        )}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        <p style={{ fontSize: 11.5, color: '#999', margin: '4px 0 0' }}>{t('formPhotoHint')}</p>
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
        {staffRows.map((row, idx) => {
          // Every row's own current name is offered even if it isn't in
          // existingStaffNames (unique to this service, or not chosen yet)
          // — otherwise switching back from free-text mode would have
          // nothing to reselect it with.
          const options = row.name && !existingStaffNames.includes(row.name)
            ? [...existingStaffNames, row.name]
            : existingStaffNames;
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              {row.isNew ? (
                <input
                  name={`staffName_${idx}`}
                  required
                  value={row.name}
                  onChange={(e) => updateStaffRow(idx, { name: e.target.value })}
                  placeholder={t('formStaffNamePlaceholder')}
                  style={{ flex: 1 }}
                />
              ) : (
                <select
                  name={`staffName_${idx}`}
                  required
                  value={row.name}
                  onChange={(e) => {
                    if (e.target.value === NEW_STAFF_VALUE) updateStaffRow(idx, { name: '', isNew: true });
                    else updateStaffRow(idx, { name: e.target.value });
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="" disabled>
                    {t('formStaffSelectPlaceholder')}
                  </option>
                  {options.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value={NEW_STAFF_VALUE}>{t('formStaffNewOption')}</option>
                </select>
              )}
              {row.isNew && options.length > 0 && (
                <button
                  type="button"
                  onClick={() => updateStaffRow(idx, { name: '', isNew: false })}
                  className="dash-btn dash-btn-secondary"
                  style={{ padding: '4px 10px', flexShrink: 0 }}
                >
                  {t('formStaffBackToList')}
                </button>
              )}
              <input
                name={`staffDuration_${idx}`}
                type="number"
                min={1}
                step="1"
                value={row.duration}
                onChange={(e) => updateStaffRow(idx, { duration: e.target.value })}
                placeholder={t('formStaffDurationPlaceholder')}
                style={{ width: 96, flexShrink: 0 }}
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
          );
        })}
        <button type="button" onClick={addStaffRow} className="dash-btn dash-btn-secondary" style={{ marginTop: 2 }}>
          {t('formStaffAdd')}
        </button>
      </div>

      <div className="dash-form-row">
        <label>{t('formVariantsLabel')}</label>
        <p style={{ fontSize: 11.5, color: '#999', margin: '0 0 8px' }}>{t('formVariantsHint')}</p>
        {variantRows.map((row, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input
              name={`variantLabel_${idx}`}
              required
              value={row.label}
              onChange={(e) => updateVariantRow(idx, { label: e.target.value })}
              placeholder={t('formVariantLabelPlaceholder')}
              style={{ flex: 1 }}
            />
            <input
              name={`variantPrice_${idx}`}
              type="number"
              min={0}
              step="0.01"
              required
              value={row.price}
              onChange={(e) => updateVariantRow(idx, { price: e.target.value })}
              placeholder={t('formVariantPricePlaceholder')}
              style={{ width: 110, flexShrink: 0 }}
            />
            <input
              name={`variantDuration_${idx}`}
              type="number"
              min={1}
              step="1"
              required
              value={row.duration}
              onChange={(e) => updateVariantRow(idx, { duration: e.target.value })}
              placeholder={t('formVariantDurationPlaceholder')}
              style={{ width: 96, flexShrink: 0 }}
            />
            <button
              type="button"
              onClick={() => removeVariantRow(idx)}
              className="dash-btn dash-btn-secondary"
              style={{ padding: '4px 10px', flexShrink: 0 }}
            >
              {t('formStaffRemove')}
            </button>
          </div>
        ))}
        <button type="button" onClick={addVariantRow} className="dash-btn dash-btn-secondary" style={{ marginTop: 2 }}>
          {t('formVariantsAdd')}
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row' }}>
          <span className="dash-switch">
            <input type="checkbox" name="is24h" checked={is24h} onChange={(e) => setIs24h(e.target.checked)} />
            <span className="dash-switch-track" />
          </span>
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
