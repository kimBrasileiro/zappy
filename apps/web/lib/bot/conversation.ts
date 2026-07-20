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

// The whole platform shares ONE WhatsApp Business number, so a raw inbound
// phone number alone doesn't say which company the message is for. The
// convention: the message starts with "Z:<company-slug>" — from the widget's
// "Continuar no WhatsApp" button, the dashboard's Instalação page, or the
// customer just typing it. That prefix always wins (lets a customer switch
// which company they're talking to). Without it, fall back to whichever
// company this phone number was last routed to; with neither a prefix nor a
// prior route, there's no way to guess which company a cold first contact
// is for, so the caller is told to ask for the code instead.
const WHATSAPP_CODE_PATTERN = /^Z:([a-z0-9-]+)\s*/i;

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
  if (!route) return { needsCode: true };

  const [existingCompany, existingCustomer] = await Promise.all([
    prisma.company.findUnique({ where: { id: route.companyId } }),
    prisma.customer.findUnique({ where: { id: route.customerId } }),
  ]);
  if (!existingCompany || !existingCustomer) return { needsCode: true };

  return { needsCode: false, company: existingCompany, customer: existingCustomer, message: rawText };
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
