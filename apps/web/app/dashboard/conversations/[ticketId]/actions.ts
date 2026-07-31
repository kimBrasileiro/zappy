'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { sendWhatsAppMessage, toWhatsAppPhone } from '../../../../lib/whatsapp/client';

export interface ReplyState {
  error?: string;
}

export async function sendAgentReply(
  ticketId: string,
  _prevState: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const { companyId, userId } = await requireSession();
  const t = await getTranslations('dashboard.conversations');

  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { error: t('errorEmptyMessage') };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { customer: true } });
  if (!ticket || ticket.companyId !== companyId) {
    // Same spirit as the orchestrator's G7 — never act on a ticket that
    // doesn't belong to the caller's company, even if the id lookup alone
    // would have returned something.
    return { error: t('errorTicketNotFound') };
  }

  await prisma.message.create({
    data: { ticketId, companyId, senderType: 'agent', senderId: userId, content, contentType: 'text' },
  });

  // WhatsApp tickets have no client polling the DB for new messages like the
  // widget does — without an explicit send here, an agent's reply from the
  // Inbox would just sit in Postgres and never reach the customer. Send
  // straight to the ticket's own customer.phone — NOT via WhatsAppRoute,
  // which only resolves which company an INBOUND message on the shared
  // number belongs to and gets overwritten whenever this same phone number
  // messages a different company. This ticket's company/customer are
  // already certain, so there's nothing to resolve.
  if (ticket.channel === 'whatsapp' && ticket.customer?.phone) {
    await sendWhatsAppMessage(toWhatsAppPhone(ticket.customer.phone), content);
  }

  if (ticket.status === 'bot_active' || ticket.status === 'waiting_human') {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'in_progress' } });
  }

  revalidatePath(`/dashboard/conversations/${ticketId}`);
  return {};
}

export async function resolveTicket(ticketId: string): Promise<void> {
  const { companyId } = await requireSession();

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.companyId !== companyId) return;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'resolved', resolvedAt: new Date() },
  });

  revalidatePath(`/dashboard/conversations/${ticketId}`);
  revalidatePath('/dashboard/inbox');
  revalidatePath('/dashboard/conversations');
}
