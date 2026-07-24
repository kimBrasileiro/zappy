import { prisma } from '@zappy/db';
import type { Company, Customer } from '@zappy/db';
import type { ChatMessage } from '../ai/types';
import { toLocalPhone } from '../whatsapp/client';
import { notifyEscalation } from '../notifications';

const HISTORY_LIMIT = 20;

// Anonymous widget visitors are matched by the conversationId the widget
// keeps in localStorage, stored in customers.external_id. Once the widget
// collects an email/phone (per the original spec's "fingerprint until
// identified" flow), this is where that upgrade path attaches.
export async function findOrCreateCustomer(companyId: string, conversationId: string) {
  const existing = await prisma.customer.findFirst({
    where: { companyId, externalId: conversationId },
  });
  if (existing) return existing;

  return prisma.customer.create({
    data: { companyId, externalId: conversationId },
  });
}

// WhatsApp identifies customers by phone (already the intended use of
// Customer.phone, see customer.prisma) rather than a per-session
// conversationId — the same phone number should resolve to the same
// customer across every WhatsApp conversation with this company.
export async function findOrCreateCustomerByPhone(companyId: string, phone: string) {
  const existing = await prisma.customer.findFirst({ where: { companyId, phone } });
  if (existing) return existing;

  return prisma.customer.create({ data: { companyId, phone } });
}

// An "open" ticket left untouched for 4h+ is treated as abandoned, not a
// still-ongoing conversation — applies to both channels (whichever `channel`
// the caller passes). Most relevant for one that got escalated
// (waiting_human/in_progress) and never resolved: without this, a customer
// messaging again days later would land straight in that stale escalated
// state (or stuck behind isHumanActivelyHandling) instead of getting a
// fresh bot conversation.
const STALE_TICKET_MS = 4 * 60 * 60_000;

export async function findOrCreateOpenTicket(companyId: string, customerId: string, channel: string) {
  const existing = await prisma.ticket.findFirst({
    where: {
      companyId,
      customerId,
      channel,
      status: { notIn: ['resolved', 'closed'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const isStale = Date.now() - existing.updatedAt.getTime() > STALE_TICKET_MS;
    if (!isStale) return existing;
    await prisma.ticket.update({
      where: { id: existing.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }

  return prisma.ticket.create({
    data: { companyId, customerId, channel, status: 'bot_active' },
  });
}

export type WhatsAppRouteResult =
  | { needsCode: true }
  | { needsCode: false; company: Company; customer: Customer; message: string };

// Case- and accent-insensitive substring match — same reasoning as
// lib/bot/services.ts's copy (kept separate rather than shared: this module
// matches company names, that one matches service/staff names, different
// enough domains that a shared helper wasn't worth the indirection).
function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// The whole platform shares ONE WhatsApp Business number, so a raw inbound
// phone number alone doesn't say which company the message is for. Four
// ways to resolve it, in priority order:
//   1. Explicit "Z:<company-slug>" prefix — legacy code-based switch, kept
//      for anything still generating it. Always wins, even over an existing
//      route.
//   2. The "Olá, gostaria de agendar serviços com <empresa>" pattern — this
//      exact phrase is what the widget's WhatsApp button and the dashboard's
//      direct WhatsApp link send (see apps/widget/src/widget.ts#openWhatsApp
//      and dashboard/instalacao, dashboard home). A customer clicking that
//      button on a DIFFERENT company's site than whichever one this phone
//      number was last talking to needs this to actually switch — so, like
//      the Z: prefix, it always wins over an existing route. Scoped to this
//      one rigid phrase specifically because we control its exact wording
//      end to end (it's never something a customer free-types), which is
//      what makes it safe to let it override an active conversation — a
//      loose "any company name mentioned" match here would risk switching a
//      customer away from company A just because they mentioned company B in
//      passing conversation.
//   3. An existing route for this phone number — most messages, once a
//      conversation is established.
//   4. The company's name mentioned in the free text itself (e.g. "Oi,
//      queria falar com a Zappy") — a best-effort fallback for a cold first
//      contact who didn't come through a link/QR code and won't know to
//      type a code or use the exact phrase above. Only trusted when exactly
//      one active company's name appears, and only as a first-contact
//      fallback (after the existing-route check) — anything ambiguous, or
//      any mid-conversation mention, falls through instead of guessing.
// With none of the four, there's no way to know which company a cold first
// contact is for, so the caller is told to ask for the code instead.
const WHATSAPP_CODE_PATTERN = /^Z:([a-z0-9-]+)\s*/i;
const SCHEDULE_SWITCH_PATTERN = /agendar\s+servi[cç]os?\s+com\s+["“]?([^"”.!?\n]+?)["”]?[.!?]?\s*$/i;
// What the bot actually receives once the switch phrase itself is stripped
// out — phrased to trigger orchestrator.ts's "customer wants to see
// services" rule (list_services) immediately, matching the button's whole
// point: land straight on this company's service list, no extra back-and-forth.
const SCHEDULE_SWITCH_DEFAULT_MESSAGE = 'Quero ver os serviços disponíveis para agendar.';

async function matchCompanyByNameInText(rawText: string): Promise<Company | null> {
  const normalizedText = normalizeForMatch(rawText);
  if (normalizedText.length < 3) return null;

  const companies = await prisma.company.findMany({ where: { status: 'active' } });
  const matches = companies.filter((c) => {
    const normalizedName = normalizeForMatch(c.name);
    const normalizedSlug = normalizeForMatch(c.slug);
    return (
      (normalizedName.length >= 3 && normalizedText.includes(normalizedName)) ||
      (normalizedSlug.length >= 3 && normalizedText.includes(normalizedSlug))
    );
  });

  return matches.length === 1 ? matches[0]! : null;
}

// Resolves a single already-isolated candidate name (e.g. the captured group
// from SCHEDULE_SWITCH_PATTERN) against the company directory — exact match
// first, then substring either direction, same shape as
// lib/bot/services.ts#resolveService's name matching.
async function resolveCompanyByName(candidate: string): Promise<Company | null> {
  const target = normalizeForMatch(candidate);
  if (!target) return null;

  const companies = await prisma.company.findMany({ where: { status: 'active' } });
  const exact = companies.find((c) => normalizeForMatch(c.name) === target || normalizeForMatch(c.slug) === target);
  if (exact) return exact;

  return (
    companies.find((c) => {
      const normalizedName = normalizeForMatch(c.name);
      return normalizedName.length >= 3 && (normalizedName.includes(target) || target.includes(normalizedName));
    }) ?? null
  );
}

async function switchRoute(fromWaPhoneNumber: string, company: Company): Promise<Customer> {
  const customer = await findOrCreateCustomerByPhone(company.id, toLocalPhone(fromWaPhoneNumber));
  await prisma.whatsAppRoute.upsert({
    where: { waPhoneNumber: fromWaPhoneNumber },
    create: { waPhoneNumber: fromWaPhoneNumber, companyId: company.id, customerId: customer.id },
    update: { companyId: company.id, customerId: customer.id },
  });
  return customer;
}

export async function resolveWhatsAppRoute(fromWaPhoneNumber: string, rawText: string): Promise<WhatsAppRouteResult> {
  const codeMatch = rawText.match(WHATSAPP_CODE_PATTERN);
  const company = codeMatch ? await prisma.company.findUnique({ where: { slug: codeMatch[1]!.toLowerCase() } }) : null;

  if (company) {
    const customer = await switchRoute(fromWaPhoneNumber, company);
    const message = rawText.slice(codeMatch![0].length).trim() || 'Olá!';
    return { needsCode: false, company, customer, message };
  }

  const switchMatch = rawText.match(SCHEDULE_SWITCH_PATTERN);
  const switchCompany = switchMatch ? await resolveCompanyByName(switchMatch[1]!) : null;
  if (switchCompany) {
    const customer = await switchRoute(fromWaPhoneNumber, switchCompany);
    return { needsCode: false, company: switchCompany, customer, message: SCHEDULE_SWITCH_DEFAULT_MESSAGE };
  }

  const route = await prisma.whatsAppRoute.findUnique({ where: { waPhoneNumber: fromWaPhoneNumber } });
  if (route) {
    const [existingCompany, existingCustomer] = await Promise.all([
      prisma.company.findUnique({ where: { id: route.companyId } }),
      prisma.customer.findUnique({ where: { id: route.customerId } }),
    ]);
    if (existingCompany && existingCustomer) {
      return { needsCode: false, company: existingCompany, customer: existingCustomer, message: rawText };
    }
  }

  const guessedCompany = await matchCompanyByNameInText(rawText);
  if (guessedCompany) {
    const customer = await findOrCreateCustomerByPhone(guessedCompany.id, toLocalPhone(fromWaPhoneNumber));
    await prisma.whatsAppRoute.upsert({
      where: { waPhoneNumber: fromWaPhoneNumber },
      create: { waPhoneNumber: fromWaPhoneNumber, companyId: guessedCompany.id, customerId: customer.id },
      update: { companyId: guessedCompany.id, customerId: customer.id },
    });
    return { needsCode: false, company: guessedCompany, customer, message: rawText };
  }

  return { needsCode: true };
}

// Called by the escalate_human tool when the customer asks for a real
// person. waiting_human (rather than in_progress) distinguishes "the bot
// handed this off" from "an agent already replied" for the Inbox view. The
// bot keeps answering normally after this (see orchestrator.ts's G11), so
// escalate_human can legitimately fire again on a later message in the same
// still-open ticket — the owner-email notification is scoped to the actual
// transition into escalated, not every call, so it doesn't re-notify on
// every subsequent request for a human.
export async function escalateToHuman(ticketId: string) {
  const before = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
  const wasAlreadyEscalated = before?.status === 'waiting_human' || before?.status === 'in_progress';

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'waiting_human' },
  });
  if (!wasAlreadyEscalated) await notifyEscalation(ticket.companyId);
}

export async function loadHistory(ticketId: string): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: { ticketId, isInternal: false },
    orderBy: { createdAt: 'asc' },
    take: HISTORY_LIMIT,
  });

  // 'agent' (a human reply sent from the dashboard) counts as 'assistant'
  // too — otherwise the model would ignore what a human already told the
  // customer and risk repeating or contradicting it.
  return messages
    .filter((m) => m.senderType === 'customer' || m.senderType === 'bot' || m.senderType === 'agent')
    .map((m) => ({
      role: m.senderType === 'customer' ? 'user' : 'assistant',
      content: m.content,
    }));
}

export async function appendMessage(
  ticketId: string,
  companyId: string,
  senderType: 'customer' | 'bot',
  content: string,
) {
  return prisma.message.create({
    data: { ticketId, companyId, senderType, content, contentType: 'text' },
  });
}
