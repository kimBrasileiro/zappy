'use client';

import { useState } from 'react';
import type { Booking, Customer, Service } from '@zappigo/db';
import { cancelBooking, markBookingAttended, markBookingNoShow } from './actions';
import { BookingsCalendar } from './bookings-calendar';

type BookingWithRelations = Booking & { service: Service; customer: Customer | null };

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'dash-badge-in_progress',
  completed: 'dash-badge-open',
  cancelled: 'dash-badge-closed',
  no_show: 'dash-badge-canceled',
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

// Business hours/availability are computed treating scheduledAt as
// America/Sao_Paulo wall-clock (see lib/timezone.ts and checkAvailability
// in lib/bot/services.ts) — displaying it in the viewer's own browser
// timezone here would show a different hour than what was actually offered
// to and confirmed by the customer. Must stay Brazil-local until real
// per-company timezone support exists.
function formatScheduledAt(date: Date): string {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function BookingsView({ bookings, emptyLabel }: { bookings: BookingWithRelations[]; emptyLabel: string }) {
  const [view, setView] = useState<'list' | 'calendar'>('list');

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={view === 'list' ? 'dash-btn' : 'dash-btn dash-btn-secondary'}
          onClick={() => setView('list')}
        >
          Lista
        </button>
        <button
          type="button"
          className={view === 'calendar' ? 'dash-btn' : 'dash-btn dash-btn-secondary'}
          onClick={() => setView('calendar')}
        >
          Calendário
        </button>
      </div>

      {view === 'calendar' ? (
        <BookingsCalendar bookings={bookings} />
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Data/hora</th>
              <th>Duração</th>
              <th>Preço</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{booking.service.name}</td>
                <td>{booking.customer?.name ?? booking.customer?.email ?? booking.customer?.externalId ?? 'Anônimo'}</td>
                <td>{booking.customer?.phone ?? '—'}</td>
                <td>{formatScheduledAt(booking.scheduledAt)}</td>
                <td>{booking.durationMinutes} min</td>
                <td>{formatPrice(booking.priceCents)}</td>
                <td>
                  <span className={`dash-badge ${STATUS_BADGE[booking.status] ?? 'dash-badge-closed'}`}>
                    {STATUS_LABEL[booking.status] ?? booking.status}
                  </span>
                </td>
                <td>
                  {booking.status === 'confirmed' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <form action={markBookingAttended.bind(null, booking.id)}>
                        <button type="submit" className="dash-btn dash-btn-secondary" title="Marcar que o cliente compareceu">
                          Compareceu
                        </button>
                      </form>
                      <form action={markBookingNoShow.bind(null, booking.id)}>
                        <button type="submit" className="dash-btn dash-btn-secondary" title="Marcar que o cliente faltou">
                          Faltou
                        </button>
                      </form>
                      <form action={cancelBooking.bind(null, booking.id)}>
                        <button type="submit" className="dash-btn dash-btn-danger">
                          Cancelar
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: '#999' }}>
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}
