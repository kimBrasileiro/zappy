import { prisma, type Prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { RefreshButton } from '../refresh-button';
import { BookingsView } from './bookings-view';
import { brazilWallClockToUtc } from '../../../lib/timezone';

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
    // scheduledAt is Brazil-local wall-clock anchored (see lib/timezone.ts
    // and BookingsView's formatScheduledAt) — the date filter matches that
    // same convention, not the server or browser's local timezone.
    const [year, month, day] = date.split('-').map(Number);
    if (year && month && day) {
      const dayStart = brazilWallClockToUtc(year, month - 1, day, 0, 0);
      const dayEnd = brazilWallClockToUtc(year, month - 1, day, 23, 59, 59, 999);
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

      <BookingsView
        bookings={bookings}
        emptyLabel={q || date ? 'Nenhum agendamento encontrado com esse filtro.' : 'Nenhum agendamento ainda.'}
      />
    </>
  );
}
