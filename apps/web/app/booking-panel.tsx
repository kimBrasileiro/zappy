'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { getPublicAvailability, submitPublicBooking } from './booking-actions';

const BRAND_COLOR = '#2563eb';

type PublicService = {
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  staffOptions?: string[];
};

type Slot = { time: string; iso: string };

type AvailabilityResult = {
  error?: string;
  reason?: string;
  morningSlots?: Slot[];
  afternoonSlots?: Slot[];
};

type BookingErrorCode =
  | 'company_not_found'
  | 'service_not_found'
  | 'unknown_staff'
  | 'staff_absent'
  | 'all_staff_absent'
  | 'slot_unavailable'
  | 'missing_customer_name'
  | 'invalid_customer_phone'
  | 'rate_limited'
  | 'existing_booking_conflict'
  | 'invalid_datetime';

const ERROR_KEY: Record<BookingErrorCode, string> = {
  company_not_found: 'errorGeneric',
  service_not_found: 'errorGeneric',
  unknown_staff: 'errorGeneric',
  invalid_datetime: 'errorGeneric',
  staff_absent: 'errorStaffUnavailable',
  all_staff_absent: 'errorStaffUnavailable',
  slot_unavailable: 'errorSlotUnavailable',
  missing_customer_name: 'errorMissingName',
  invalid_customer_phone: 'errorInvalidPhone',
  rate_limited: 'errorRateLimited',
  existing_booking_conflict: 'errorExistingBooking',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d8dce3',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#444',
  marginBottom: 6,
  textAlign: 'left',
};

export function BookingPanel({
  companySlug,
  services,
  minDate,
  locale,
  currencyCode,
}: {
  companySlug: string;
  services: PublicService[];
  minDate: string;
  locale: string;
  currencyCode: string;
}) {
  const t = useTranslations('bookingPanel');

  const [serviceName, setServiceName] = useState(services[0]?.name ?? '');
  const [staffName, setStaffName] = useState('');
  const [date, setDate] = useState(minDate);

  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedService = useMemo(() => services.find((s) => s.name === serviceName) ?? null, [services, serviceName]);

  const formatPrice = (cents: number) => (cents / 100).toLocaleString(locale, { style: 'currency', currency: currencyCode });

  async function handleCheckAvailability() {
    if (!serviceName || !date) return;
    setAvailabilityLoading(true);
    setAvailability(null);
    setSelectedSlot(null);
    try {
      const result = await getPublicAvailability(companySlug, serviceName, date, staffName || undefined);
      setAvailability(result);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedService || !selectedSlot) return;
    if (!name.trim()) {
      setSubmitError(t('errorMissingName'));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitPublicBooking(companySlug, {
        serviceName: selectedService.name,
        scheduledAt: selectedSlot.iso,
        staffName: staffName || undefined,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
      });
      if ('success' in result && result.success) {
        setSuccess(true);
      } else {
        const code = (result.error ?? 'service_not_found') as BookingErrorCode;
        setSubmitError(t(ERROR_KEY[code] ?? 'errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setSuccess(false);
    setSelectedSlot(null);
    setAvailability(null);
    setName('');
    setPhone('');
    setEmail('');
    setSubmitError(null);
  }

  if (services.length === 0) return null;

  const dateLabel = selectedSlot
    ? new Date(`${date}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return (
    <div style={{ maxWidth: 420, margin: '40px auto 0', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
        <span style={{ color: '#999', fontSize: 13 }}>{t('divider')}</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
      </div>

      <div
        style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          padding: 24,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {success ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{t('successTitle')}</h3>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
              {t('successBody', { service: selectedService?.name ?? '', date: dateLabel, time: selectedSlot?.time ?? '' })}
            </p>
            <button type="button" onClick={reset} style={{ ...buttonStyle, background: '#fff', color: BRAND_COLOR, border: `1px solid ${BRAND_COLOR}` }}>
              {t('bookAnotherButton')}
            </button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{t('title')}</h3>
            <p style={{ color: '#777', fontSize: 13, margin: '0 0 20px' }}>{t('subtitle')}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('serviceLabel')}</label>
              <select
                style={inputStyle}
                value={serviceName}
                onChange={(e) => {
                  setServiceName(e.target.value);
                  setStaffName('');
                  setAvailability(null);
                  setSelectedSlot(null);
                }}
              >
                {services.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              {selectedService && (
                <p style={{ color: '#999', fontSize: 12, margin: '6px 0 0' }}>
                  {t('durationMinutes', { minutes: selectedService.durationMinutes })} · {formatPrice(selectedService.priceCents)}
                </p>
              )}
            </div>

            {selectedService?.staffOptions && selectedService.staffOptions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('staffLabel')}</label>
                <select
                  style={inputStyle}
                  value={staffName}
                  onChange={(e) => {
                    setStaffName(e.target.value);
                    setAvailability(null);
                    setSelectedSlot(null);
                  }}
                >
                  <option value="">{t('staffAnyOption')}</option>
                  {selectedService.staffOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedSlot && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('dateLabel')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    min={minDate}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setAvailability(null);
                      setSelectedSlot(null);
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleCheckAvailability}
                    disabled={!date || availabilityLoading}
                    style={{ ...buttonStyle, whiteSpace: 'nowrap', opacity: !date || availabilityLoading ? 0.6 : 1 }}
                  >
                    {availabilityLoading ? t('checkingAvailability') : t('checkAvailabilityButton')}
                  </button>
                </div>
              </div>
            )}

            {!selectedSlot && availability && !availabilityLoading && (
              <SlotGrid availability={availability} t={t} onSelect={setSelectedSlot} />
            )}

            {selectedSlot && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f5f7ff',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 16,
                    fontSize: 13,
                  }}
                >
                  <span>{t('selectedSummary', { service: selectedService?.name ?? '', date: dateLabel, time: selectedSlot.time })}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(null)}
                    style={{ background: 'none', border: 'none', color: BRAND_COLOR, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {t('changeTime')}
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>{t('nameLabel')}</label>
                  <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>{t('phoneLabel')}</label>
                  <input
                    style={inputStyle}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('phonePlaceholder')}
                    type="tel"
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('emailLabel')}</label>
                  <input
                    style={inputStyle}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    type="email"
                  />
                </div>

                {submitError && <p style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 12px' }}>{submitError}</p>}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !name.trim() || !phone.trim()}
                  style={{ ...buttonStyle, width: '100%', opacity: submitting || !name.trim() || !phone.trim() ? 0.6 : 1 }}
                >
                  {submitting ? t('submittingButton') : t('confirmButton')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SlotGrid({
  availability,
  t,
  onSelect,
}: {
  availability: AvailabilityResult;
  t: ReturnType<typeof useTranslations>;
  onSelect: (slot: Slot) => void;
}) {
  if (availability.error) {
    return <p style={{ color: '#b91c1c', fontSize: 13 }}>{t('errorGeneric')}</p>;
  }
  if (availability.reason === 'closed_that_day') {
    return <p style={{ color: '#777', fontSize: 13 }}>{t('closedThatDay')}</p>;
  }
  const morning = availability.morningSlots ?? [];
  const afternoon = availability.afternoonSlots ?? [];
  if (morning.length === 0 && afternoon.length === 0) {
    return <p style={{ color: '#777', fontSize: 13 }}>{t('noSlots')}</p>;
  }

  const SlotButton = ({ slot }: { slot: Slot }) => (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: `1px solid ${BRAND_COLOR}`,
        background: '#fff',
        color: BRAND_COLOR,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {slot.time}
    </button>
  );

  return (
    <div style={{ marginBottom: 4 }}>
      {morning.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {t('morningLabel')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {morning.map((s) => (
              <SlotButton key={s.iso} slot={s} />
            ))}
          </div>
        </div>
      )}
      {afternoon.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {t('afternoonLabel')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {afternoon.map((s) => (
              <SlotButton key={s.iso} slot={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const buttonStyle: CSSProperties = {
  padding: '10px 18px',
  borderRadius: 8,
  border: 'none',
  background: BRAND_COLOR,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
