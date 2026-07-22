import { prisma, type Prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { cancelBooking, markBookingAttended, markBookingNoShow } from './actions';
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
  no_show: 'dash-badge-canceled',
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'confirmado',
  completed: 'compareceu',
  cancelled: 'cancelado',
  no_show: 'faltou',
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { q?: string; date?: string };
}) {
  const { companyId } = await requireSession();
  const q = searchParams.q?.trim();
  const date = searchParams.date?.trim();

  const where: Prisma.BookingWhereInput = { companyId };

  if (q) {
    // Same free-text field searches both name and phone — the customer
    // record is already resolved by the time a booking exists, so this is
    // just an OR across the two fields most people would actually type.
    where.customer = { is: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } };
  }

  if (date) {
    // scheduledAt is UTC-anchored (see formatScheduledAt above) — the date
    // filter matches that same convention, not the server or browser's
    // local timezone.
    const [year, month, day] = date.split('-').map(Number);
    if (year && month && day) {
      const dayStart = new Date(Date.UTC(year, month - 1, day));
      const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      where.scheduledAt = { gte: dayStart, lte: dayEnd };
    }
  }

  const bookings = await prisma.booking.findMany({
    where,
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

      <form method="get" className="dash-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '16px 20px', marginBottom: 20 }}>
        <label className="dash-form-row" style={{ flex: 1, marginBottom: 0 }}>
          Nome ou telefone
          <input type="text" name="q" defaultValue={q} placeholder="Ex: Maria ou 11 98765-4321" />
        </label>
        <label className="dash-form-row" style={{ marginBottom: 0 }}>
          Data
          <input type="date" name="date" defaultValue={date} />
        </label>
        <button type="submit" className="dash-btn">
          Buscar
        </button>
        {(q || date) && (
          <a href="/dashboard/bookings" className="dash-btn dash-btn-secondary" style={{ textDecoration: 'none' }}>
            Limpar
          </a>
        )}
      </form>

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
                {q || date ? 'Nenhum agendamento encontrado com esse filtro.' : 'Nenhum agendamento ainda.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
