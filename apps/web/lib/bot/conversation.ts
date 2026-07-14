import { prisma } from '@zappy/db';
import type { ChatMessage } from '../ai/types';

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

export async function findOrCreateOpenTicket(companyId: string, customerId: string) {
  const existing = await prisma.ticket.findFirst({
    where: {
      companyId,
      customerId,
      channel: 'site_chat',
      status: { notIn: ['resolved', 'closed'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  return prisma.ticket.create({
    data: { companyId, customerId, channel: 'site_chat', status: 'bot_active' },
  });
}

// Called by the escalate_human tool when the customer asks for a real
// person. waiting_human (rather than in_progress) distinguishes "the bot
// handed this off" from "an agent already replied" for the Inbox view.
export async function escalateToHuman(ticketId: string) {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'waiting_human' },
  });
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
