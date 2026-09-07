'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, type Event, type SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import type { Booking, Customer, Service } from '@zappigo/db';
import { cancelBooking, markBookingAttended, markBookingNoShow } from './actions';
import { addStaffAbsence, removeStaffAbsence } from '../services/actions';
import { toWallClock } from '../../../lib/format-time';
import 'react-big-calendar/lib/css/react-big-calendar.css';

type StaffService = { id: string; name: string; staffNames: string[] };
type AbsenceRow = { id: string; serviceId: string; staffName: string; date: Date };

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The calendar grid itself (month/week names, "next"/"today" chrome) stays
// pt-BR-locale — same scope cut as scheduledAt formatting throughout this
// codebase (see lib/format-time.ts): no per-viewer calendar-locale support
// exists yet, so this widget's own chrome isn't part of the pt/es/en UI
// switcher. The booking action buttons and status labels below it are.

type BookingWithRelations = Booking & { service: Service; customer: Customer | null };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales: { 'pt-BR': ptBR },
});

const MESSAGES = {
  next: 'Próximo',
  previous: 'Anterior',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Agendamento',
  noEventsInRange: 'Nenhum agendamento nesse período.',
  showMore: (count: number) => `+${count} mais`,
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#2563eb',
  completed: '#16a34a',
  cancelled: '#9ca3af',
  no_show: '#dc2626',
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// scheduledAt is stored and always treated as this deployment's own local
// wall-clock time throughout this codebase (see lib/format-time.ts and
// checkAvailability in lib/bot/services.ts) — no real per-company timezone
// support exists yet. react-big-calendar renders whatever LOCAL time a Date
// reports, so feeding it scheduledAt directly would silently shift every
// event by the viewer's browser offset. This builds a Date that encodes the
// same deployment-local Y/M/D/H/M as local-time fields, so e.g. 09:00
// always displays as 09:00 regardless of who's viewing it.
function toWallClockLocalDate(d: Date, timeZone: string): Date {
  const local = toWallClock(timeZone, d);
  return new Date(local.year, local.month0, local.day, local.hour, local.minute);
}

type BookingEvent = Event & { resource: BookingWithRelations };

export function BookingsCalendar({
  bookings,
  timeZone,
  staffServices,
  absences,
}: {
  bookings: BookingWithRelations[];
  timeZone: string;
  staffServices: StaffService[];
  absences: AbsenceRow[];
}) {
  const t = useTranslations('dashboard.bookings');
  const router = useRouter();
  const [selected, setSelected] = useState<BookingWithRelations | null>(null);
  const [absenceDate, setAbsenceDate] = useState<Date | null>(null);
  const [absenceServiceId, setAbsenceServiceId] = useState('');
  const [absenceStaffName, setAbsenceStaffName] = useState('');
  const [absencePending, setAbsencePending] = useState(false);
  const [absenceError, setAbsenceError] = useState<string | null>(null);

  const absenceService = staffServices.find((s) => s.id === absenceServiceId) ?? null;
  const absencesForDay = absenceDate ? absences.filter((a) => dateKey(a.date) === dateKey(absenceDate)) : [];

  function openAbsencePopover(date: Date) {
    setAbsenceDate(date);
    setAbsenceServiceId(staffServices[0]?.id ?? '');
    setAbsenceStaffName('');
    setAbsenceError(null);
  }

  async function handleAddAbsence() {
    if (!absenceDate || !absenceServiceId || !absenceStaffName) return;
    setAbsencePending(true);
    setAbsenceError(null);
    const formData = new FormData();
    formData.set('staffName', absenceStaffName);
    formData.set('date', dateKey(absenceDate));
    const result = await addStaffAbsence(absenceServiceId, {}, formData);
    setAbsencePending(false);
    if (result.error) {
      setAbsenceError(result.error);
      return;
    }
    setAbsenceStaffName('');
    router.refresh();
  }

  async function handleRemoveAbsence(serviceId: string, absenceId: string) {
    await removeStaffAbsence(serviceId, absenceId);
    router.refresh();
  }

  const statusLabel: Record<string, string> = {
    confirmed: t('statusConfirmed'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
    no_show: t('statusNoShow'),
  };

  const events = useMemo<BookingEvent[]>(
    () =>
      bookings.map((booking) => {
        const start = toWallClockLocalDate(booking.scheduledAt, timeZone);
        return {
          title: `${booking.service.name} — ${booking.customer?.name ?? t('anonymous')}`,
          start,
          end: new Date(start.getTime() + booking.durationMinutes * 60_000),
          resource: booking,
        };
      }),
    [bookings, t, timeZone],
  );

  return (
    <div className="dash-calendar">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 640 }}
        culture="pt-BR"
        messages={MESSAGES}
        eventPropGetter={(event) => ({
          style: {
            backgroundColor: STATUS_COLOR[(event as BookingEvent).resource.status] ?? STATUS_COLOR.confirmed,
            borderRadius: 6,
            border: 'none',
          },
        })}
        onSelectEvent={(event) => setSelected((event as BookingEvent).resource)}
        selectable={staffServices.length > 0}
        onSelectSlot={(slotInfo: SlotInfo) => openAbsencePopover(slotInfo.start)}
      />

      {selected && (
        <div className="dash-calendar-popover-backdrop" onClick={() => setSelected(null)}>
          <div className="dash-card dash-calendar-popover" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{selected.service.name}</h3>
              <span className={`dash-badge dash-badge-${selected.status === 'confirmed' ? 'in_progress' : selected.status === 'completed' ? 'open' : selected.status === 'no_show' ? 'canceled' : 'closed'}`}>
                {statusLabel[selected.status] ?? selected.status}
              </span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 13.5, color: '#444' }}>
              {selected.customer?.name ?? selected.customer?.email ?? selected.customer?.externalId ?? t('anonymous')}
              {selected.customer?.phone ? ` — ${selected.customer.phone}` : ''}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 13.5, color: '#444' }}>
              {toWallClockLocalDate(selected.scheduledAt, timeZone).toLocaleString('pt-BR')} · {selected.durationMinutes} min · {formatPrice(selected.priceCents)}
            </p>
            {selected.status === 'confirmed' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                <form action={async () => { await markBookingAttended(selected.id); setSelected(null); }}>
                  <button type="submit" className="dash-btn dash-btn-secondary">{t('attendedButton')}</button>
                </form>
                <form action={async () => { await markBookingNoShow(selected.id); setSelected(null); }}>
                  <button type="submit" className="dash-btn dash-btn-secondary">{t('noShowButton')}</button>
                </form>
                <form action={async () => { await cancelBooking(selected.id); setSelected(null); }}>
                  <button type="submit" className="dash-btn dash-btn-danger">{t('cancelButton')}</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {absenceDate && (
        <div className="dash-calendar-popover-backdrop" onClick={() => setAbsenceDate(null)}>
          <div className="dash-card dash-calendar-popover" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
              {t('absenceTitle', { date: absenceDate.toLocaleDateString('pt-BR') })}
            </h3>

            {absencesForDay.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {absencesForDay.map((a) => {
                  const service = staffServices.find((s) => s.id === a.serviceId);
                  return (
                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                      <span>
                        {a.staffName} — {service?.name ?? a.serviceId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAbsence(a.serviceId, a.id)}
                        className="dash-btn dash-btn-secondary"
                        style={{ padding: '3px 9px', fontSize: 12 }}
                      >
                        {t('absenceRemove')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {staffServices.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {absenceError && <div style={{ color: '#b91c1c', fontSize: 13 }}>{absenceError}</div>}
                {staffServices.length > 1 && (
                  <select
                    value={absenceServiceId}
                    onChange={(e) => {
                      setAbsenceServiceId(e.target.value);
                      setAbsenceStaffName('');
                    }}
                  >
                    {staffServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                <select value={absenceStaffName} onChange={(e) => setAbsenceStaffName(e.target.value)}>
                  <option value="" disabled>
                    {t('absenceStaffPlaceholder')}
                  </option>
                  {(absenceService?.staffNames ?? []).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddAbsence}
                  disabled={!absenceStaffName || absencePending}
                  className="dash-btn"
                >
                  {absencePending ? t('absenceSaving') : t('absenceAddButton')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
