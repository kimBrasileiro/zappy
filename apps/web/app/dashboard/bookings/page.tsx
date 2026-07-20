import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { cancelBooking } from './actions';
import { RefreshButton } from '../refresh-button';

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Business hours/availability are computed treating scheduledAt as UTC (see
// checkAvailability in lib/bot/services.ts) — displaying it in the server's
// local timezone here would show a different hour than what was actually
// offered to and confirmed by the customer. Must stay UTC until real
// per-company timezone support exists.
function formatScheduledAt(date: Date): string {
  return date.toLocaleString('pt-BR', { timeZone: 'UTC' });
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'dash-badge-in_progress',
  completed: 'dash-badge-open',
  cancelled: 'dash-badge-closed',
};

export default async function BookingsPage() {
  const { companyId } = await requireSession();

  const bookings = await prisma.booking.findMany({
    where: { companyId },
    include: { service: true, customer: true },
    orderBy: { scheduledAt: 'desc' },
    take: 200,
  });

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">Agendamentos</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            Todos os agendamentos criados pelo bot (ou manualmente), mais recentes primeiro.
          </p>
        </div>
        <RefreshButton />
      </div>

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
                  {booking.status}
                </span>
              </td>
              <td>
                {booking.status === 'confirmed' && (
                  <form action={cancelBooking.bind(null, booking.id)}>
                    <button type="submit" className="dash-btn dash-btn-danger">
                      Cancelar
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {bookings.length === 0 && (
            <tr>
              <td colSpan={8} style={{ color: '#999' }}>
                Nenhum agendamento ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
