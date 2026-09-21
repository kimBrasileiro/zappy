import { prisma } from '@zappigo/db';
import { normalizePhone } from '../bot/services';

// One place for "the chat / form just told us who this person is". The phone
// number is the primary key of a person (Customer has @@unique([companyId,
// phone]) and it's what WhatsApp identifies people by); the row a widget or
// form session starts with (externalId only, no phone) is just a temporary
// handle that gets folded into the phone's row as soon as we learn the phone.
//
// Everything we learn is written immediately — name, phone, email — rather
// than waiting for a booking to succeed, so a conversation that ends before
// the enrollment still leaves a usable contact behind.

interface ContactInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

function cleanEmail(email: string | null | undefined): string | null {
  const value = (email ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

// The phone-less session row points at the phone-owning row it was merged
// into, so later turns of the SAME conversation (whose orchestrator lookup is
// still by externalId) keep resolving to the real person.
export async function resolvePlayerId(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const row = await prisma.customer.findUnique({ where: { id: customerId }, select: { metadata: true } });
  const linked = (row?.metadata as { canonicalCustomerId?: unknown } | null)?.canonicalCustomerId;
  if (typeof linked !== 'string') return customerId;
  const target = await prisma.customer.findUnique({ where: { id: linked }, select: { id: true } });
  return target?.id ?? customerId;
}

export async function saveCustomerContact(
  companyId: string,
  currentCustomerId: string | null,
  input: ContactInput,
): Promise<{ customerId: string; merged: boolean }> {
  const name = input.name?.trim() || null;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const email = cleanEmail(input.email);

  const current = currentCustomerId ? await prisma.customer.findUnique({ where: { id: currentCustomerId } }) : null;
  const byPhone = phone ? await prisma.customer.findFirst({ where: { companyId, phone } }) : null;

  let target = byPhone ?? current;
  if (!target) {
    target = await prisma.customer.create({ data: { companyId, name, phone, email: await freeEmail(companyId, email, null) } });
    return { customerId: target.id, merged: false };
  }

  const data: { name?: string; phone?: string; email?: string } = {};
  if (name && !target.name) data.name = name;
  if (phone && !target.phone) data.phone = phone;
  if (email && !target.email) {
    const usable = await freeEmail(companyId, email, target.id);
    if (usable) data.email = usable;
  }
  if (Object.keys(data).length > 0) await prisma.customer.update({ where: { id: target.id }, data });

  const merged = !!current && current.id !== target.id;
  if (merged && current) {
    // Whatever the phone-less session row already collected follows the
    // person, without overwriting anything the phone row already knows.
    const carried = await prisma.customerSportLevel.findMany({ where: { companyId, customerId: current.id } });
    for (const row of carried) {
      await prisma.customerSportLevel.upsert({
        where: { customerId_sport: { customerId: target.id, sport: row.sport } },
        create: { companyId, customerId: target.id, sport: row.sport, level: row.level },
        update: {},
      });
    }
    await prisma.customer.update({
      where: { id: current.id },
      data: { metadata: { ...((current.metadata as object | null) ?? {}), canonicalCustomerId: target.id } },
    });
  }
  return { customerId: target.id, merged };
}

// Customer.email is unique per company — a taken address is dropped instead of
// failing the whole save (the phone is the identity; email is a bonus).
async function freeEmail(companyId: string, email: string | null, ownerId: string | null): Promise<string | null> {
  if (!email) return null;
  const holder = await prisma.customer.findFirst({ where: { companyId, email }, select: { id: true } });
  return holder && holder.id !== ownerId ? null : email;
}
