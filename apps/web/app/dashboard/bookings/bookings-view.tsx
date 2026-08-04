'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Booking, Customer, Service } from '@zappigo/db';
import { cancelBooking, markBookingAttended, markBookingNoShow } from './actions';
import { BookingsCalendar } from './bookings-calendar';
import { formatDateTime } from '../../../lib/format-time';

type BookingWithRelations = Booking & { service: Service; customer: Customer | null };

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'dash-badge-in_progress',
  completed: 'dash-badge-open',
  cancelled: 'dash-badge-closed',
  no_show: 'dash-badge-canceled',
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function BookingsView({
  bookings,
  emptyLabel,
  locale,
  timeZone,
}: {
  bookings: BookingWithRelations[];
  emptyLabel: string;
  locale: string;
  timeZone: string;
}) {
  const t = useTranslations('dashboard.bookings');
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const statusLabel: Record<string, string> = {
    confirmed: t('statusConfirmed'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
    no_show: t('statusNoShow'),
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={view === 'list' ? 'dash-btn' : 'dash-btn dash-btn-secondary'}
          onClick={() => setView('list')}
        >
          {t('viewList')}
        </button>
        <button
          type="button"
          className={view === 'calendar' ? 'dash-btn' : 'dash-btn dash-btn-secondary'}
          onClick={() => setView('calendar')}
        >
          {t('viewCalendar')}
        </button>
      </div>

      {view === 'calendar' ? (
        <BookingsCalendar bookings={bookings} timeZone={timeZone} />
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th>{t('tableService')}</th>
              <th>{t('tableCustomer')}</th>
              <th>{t('tablePhone')}</th>
              <th>{t('tableDateTime')}</th>
              <th>{t('tableDuration')}</th>
              <th>{t('tablePrice')}</th>
              <th>{t('tableStatus')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{booking.service.name}</td>
                <td>{booking.customer?.name ?? booking.customer?.email ?? booking.customer?.externalId ?? t('anonymous')}</td>
                <td>{booking.customer?.phone ?? '—'}</td>
                <td>{formatDateTime(booking.scheduledAt, locale, timeZone)}</td>
                <td>{booking.durationMinutes} min</td>
                <td>{formatPrice(booking.priceCents)}</td>
                <td>
                  <span className={`dash-badge ${STATUS_BADGE[booking.status] ?? 'dash-badge-closed'}`}>
                    {statusLabel[booking.status] ?? booking.status}
                  </span>
                </td>
                <td>
                  {booking.status === 'confirmed' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <form action={markBookingAttended.bind(null, booking.id)}>
                        <button type="submit" className="dash-btn dash-btn-secondary" title={t('attendedTitle')}>
                          {t('attendedButton')}
                        </button>
                      </form>
                      <form action={markBookingNoShow.bind(null, booking.id)}>
                        <button type="submit" className="dash-btn dash-btn-secondary" title={t('noShowTitle')}>
                          {t('noShowButton')}
                        </button>
                      </form>
                      <form action={cancelBooking.bind(null, booking.id)}>
                        <button type="submit" className="dash-btn dash-btn-danger">
                          {t('cancelButton')}
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
