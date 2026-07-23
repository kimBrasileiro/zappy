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
  if (existing) return existing;

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
// phone number alone doesn't say which company the message is for. Three
// ways to resolve it, in priority order:
//   1. Explicit "Z:<company-slug>" prefix — from the widget's "Continuar no
//      WhatsApp" button or the dashboard's Instalação page/QR code. Always
//      wins, even over an existing route, since it's how a customer
//      explicitly switches which company they're talking to.
//   2. An existing route for this phone number — most messages, once a
//      conversation is established.
//   3. The company's name mentioned in the free text itself (e.g. "Oi,
//      queria falar com a Zappy") — a best-effort fallback for a cold first
//      contact who didn't come through a link/QR code and won't know to
//      type a code. Only trusted when exactly one active company's name
//      appears; anything ambiguous falls through to asking for the code
//      rather than guessing wrong.
// With none of the three, there's no way to know which company a cold first
// contact is for, so the caller is told to ask for the code instead.
const WHATSAPP_CODE_PATTERN = /^Z:([a-z0-9-]+)\s*/i;

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

export async function resolveWhatsAppRoute(fromWaPhoneNumber: string, rawText: string): Promise<WhatsAppRouteResult> {
  const codeMatch = rawText.match(WHATSAPP_CODE_PATTERN);
  const company = codeMatch ? await prisma.company.findUnique({ where: { slug: codeMatch[1]!.toLowerCase() } }) : null;

  if (company) {
    const customer = await findOrCreateCustomerByPhone(company.id, toLocalPhone(fromWaPhoneNumber));
    await prisma.whatsAppRoute.upsert({
      where: { waPhoneNumber: fromWaPhoneNumber },
      create: { waPhoneNumber: fromWaPhoneNumber, companyId: company.id, customerId: customer.id },
      update: { companyId: company.id, customerId: customer.id },
    });
    const message = rawText.slice(codeMatch![0].length).trim() || 'Olá!';
    return { needsCode: false, company, customer, message };
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
// handed this off" from "an agent already replied" for the Inbox view.
export async function escalateToHuman(ticketId: string) {
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'waiting_human' },
  });
  await notifyEscalation(ticket.companyId);
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
