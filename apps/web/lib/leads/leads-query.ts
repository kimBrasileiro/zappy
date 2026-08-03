import { prisma } from '@zappigo/db';
import type { TicketMetadata } from '../bot/ticket-metadata';

export interface RegenerateLeadsResult {
  count: number;
  totalPotentialCents: number;
  generatedAt: Date;
}

// A "lead" is any ticket whose metadata.bookingDraft is still set — the
// customer asked check_availability about a real service/date
// (orchestrator.ts) and never completed create_booking, which is the only
// thing that clears it (see ticket-metadata.ts). Filtered in JS after a
// plain findMany rather than a Prisma JSON-path `where` clause on purpose:
// Postgres JSON-path filtering has sharp edges around "key absent" vs "key
// null", and this company's ticket volume doesn't justify that risk over a
// guaranteed-correct in-memory filter.
//
// Full regeneration, not incremental upsert: every call deletes this
// company's existing leads and reinserts from scratch, inside one
// transaction. A ticket that qualified last time but has since converted
// (booking completed, bookingDraft cleared) must disappear from the report,
// not sit there stale — upsert alone can't remove rows that stopped
// qualifying.
export async function regenerateLeadsForCompany(companyId: string): Promise<RegenerateLeadsResult> {
  const tickets = await prisma.ticket.findMany({ where: { companyId }, include: { customer: true } });

  const withDraft = tickets
    .map((ticket) => ({ ticket, draft: (ticket.metadata as TicketMetadata | null)?.bookingDraft }))
    .filter((x): x is { ticket: (typeof tickets)[number]; draft: NonNullable<TicketMetadata['bookingDraft']> } => !!x.draft);

  const serviceNames = [...new Set(withDraft.map((x) => x.draft.serviceName))];
  const services = serviceNames.length
    ? await prisma.service.findMany({ where: { companyId, name: { in: serviceNames } } })
    : [];
  const priceCentsByName = new Map(services.map((s) => [s.name, s.priceCents]));

  const generatedAt = new Date();
  const rows = withDraft.map(({ ticket, draft }) => ({
    companyId,
    ticketId: ticket.id,
    customerId: ticket.customerId,
    serviceName: draft.serviceName,
    draftDate: draft.date,
    priceCents: priceCentsByName.get(draft.serviceName) ?? null,
    channel: ticket.channel,
    customerName: ticket.customer?.name ?? null,
    customerPhone: ticket.customer?.phone ?? null,
    customerEmail: ticket.customer?.email ?? null,
    lastMessageAt: ticket.updatedAt,
    generatedAt,
  }));

  await prisma.$transaction([
    prisma.lead.deleteMany({ where: { companyId } }),
    ...(rows.length ? [prisma.lead.createMany({ data: rows })] : []),
  ]);

  const totalPotentialCents = rows.reduce((sum, r) => sum + (r.priceCents ?? 0), 0);
  return { count: rows.length, totalPotentialCents, generatedAt };
}
