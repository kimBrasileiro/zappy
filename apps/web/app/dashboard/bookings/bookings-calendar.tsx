'use client';

import { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, type Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Booking, Customer, Service } from '@zappigo/db';
import { cancelBooking, markBookingAttended, markBookingNoShow } from './actions';
import { toBrazilWallClock } from '../../../lib/timezone';
import 'react-big-calendar/lib/css/react-big-calendar.css';

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

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'confirmado',
  completed: 'compareceu',
  cancelled: 'cancelado',
  no_show: 'faltou',
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// scheduledAt is stored and always treated as America/Sao_Paulo wall-clock
// time throughout this codebase (see lib/timezone.ts and checkAvailability
// in lib/bot/services.ts) — no real per-company timezone support exists
// yet. react-big-calendar renders whatever LOCAL time a Date reports, so
// feeding it scheduledAt directly would silently shift every event by the
// viewer's browser offset. This builds a Date that encodes the same
// Brazil-local Y/M/D/H/M as local-time fields, so e.g. 09:00 always
// displays as 09:00 regardless of who's viewing it.
function toWallClockLocalDate(d: Date): Date {
  const brazil = toBrazilWallClock(d);
  return new Date(brazil.year, brazil.month0, brazil.day, brazil.hour, brazil.minute);
}

type BookingEvent = Event & { resource: BookingWithRelations };

export function BookingsCalendar({ bookings }: { bookings: BookingWithRelations[] }) {
  const [selected, setSelected] = useState<BookingWithRelations | null>(null);

  const events = useMemo<BookingEvent[]>(
    () =>
      bookings.map((booking) => {
        const start = toWallClockLocalDate(booking.scheduledAt);
        return {
          title: `${booking.service.name} — ${booking.customer?.name ?? 'Anônimo'}`,
          start,
          end: new Date(start.getTime() + booking.durationMinutes * 60_000),
          resource: booking,
        };
      }),
    [bookings],
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
                {STATUS_LABEL[selected.status] ?? selected.status}
              </span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 13.5, color: '#444' }}>
              {selected.customer?.name ?? selected.customer?.email ?? selected.customer?.externalId ?? 'Anônimo'}
              {selected.customer?.phone ? ` — ${selected.customer.phone}` : ''}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 13.5, color: '#444' }}>
              {toWallClockLocalDate(selected.scheduledAt).toLocaleString('pt-BR')} · {selected.durationMinutes} min · {formatPrice(selected.priceCents)}
            </p>
            {selected.status === 'confirmed' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                <form action={async () => { await markBookingAttended(selected.id); setSelected(null); }}>
                  <button type="submit" className="dash-btn dash-btn-secondary">Compareceu</button>
                </form>
                <form action={async () => { await markBookingNoShow(selected.id); setSelected(null); }}>
                  <button type="submit" className="dash-btn dash-btn-secondary">Faltou</button>
                </form>
                <form action={async () => { await cancelBooking(selected.id); setSelected(null); }}>
                  <button type="submit" className="dash-btn dash-btn-danger">Cancelar</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
