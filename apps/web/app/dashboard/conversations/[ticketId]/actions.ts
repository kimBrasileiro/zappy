'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { sendWhatsAppMessage } from '../../../../lib/whatsapp/client';

export interface ReplyState {
  error?: string;
}

export async function sendAgentReply(
  ticketId: string,
  _prevState: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const { companyId, userId } = await requireSession();

  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { error: 'Escreve uma mensagem antes de enviar.' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.companyId !== companyId) {
    // Same spirit as the orchestrator's G7 — never act on a ticket that
    // doesn't belong to the caller's company, even if the id lookup alone
    // would have returned something.
    return { error: 'Ticket não encontrado.' };
  }

  await prisma.message.create({
    data: { ticketId, companyId, senderType: 'agent', senderId: userId, content, contentType: 'text' },
  });

  // WhatsApp tickets have no client polling the DB for new messages like the
  // widget does — without an explicit send here, an agent's reply from the
  // Inbox would just sit in Postgres and never reach the customer.
  if (ticket.channel === 'whatsapp' && ticket.customerId) {
    const route = await prisma.whatsAppRoute.findFirst({ where: { customerId: ticket.customerId } });
    if (route) await sendWhatsAppMessage(route.waPhoneNumber, content);
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
