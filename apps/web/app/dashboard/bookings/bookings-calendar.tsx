'use client';

import { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, type Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import type { Booking, Customer, Service } from '@zappigo/db';
import { cancelBooking, markBookingAttended, markBookingNoShow } from './actions';
import { toWallClock } from '../../../lib/format-time';
import 'react-big-calendar/lib/css/react-big-calendar.css';

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

export function BookingsCalendar({ bookings, timeZone }: { bookings: BookingWithRelations[]; timeZone: string }) {
  const t = useTranslations('dashboard.bookings');
  const [selected, setSelected] = useState<BookingWithRelations | null>(null);

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
    </div>
  );
}
