'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import {
  isWithinWhatsAppSessionWindow,
  resolveWhatsAppCredentials,
  sendWhatsAppMessage,
  toWhatsAppPhone,
} from '../../../../lib/whatsapp/client';
import { moderateAgentReply } from '../../../../lib/ai/gemini';
import { checkOutboundRateLimit } from '../../../../lib/bot/rate-limit';

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

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { customer: true, company: { select: { whatsappPhoneId: true, whatsappTokenEncrypted: true } } },
  });
  if (!ticket || ticket.companyId !== companyId) {
    // Same spirit as the orchestrator's G7 — never act on a ticket that
    // doesn't belong to the caller's company, even if the id lookup alone
    // would have returned something.
    return { error: t('errorTicketNotFound') };
  }

  // WABA ban-risk guardrails — only meaningful for actual outbound WhatsApp
  // sends (site_chat has no Meta policy surface at all), so scoped to that
  // channel. Checked BEFORE the Message row is created, not just before the
  // WhatsApp API call: a blocked reply shouldn't get persisted into the
  // thread looking like it went out. Every block is logged to AuditLog
  // (companyId + userId + the actual blocked content) so the Zappigo team
  // can see, per client, who's repeatedly triggering these — see
  // /admin/moderation. Not shown to the client's own dashboard; this is
  // Zappigo's own visibility into which of ITS customers risk the WABA.
  if (ticket.channel === 'whatsapp') {
    // Checked before rate-limit/moderation — it's a pure DB read (no Gemini
    // call) and a hard technical constraint from Meta's side, not a policy
    // judgment call, so there's no reason to spend an LLM call on a reply
    // that's guaranteed to be rejected on the wire anyway.
    const lastCustomerMessage = await prisma.message.findFirst({
      where: { ticketId, senderType: 'customer' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!isWithinWhatsAppSessionWindow(lastCustomerMessage?.createdAt ?? null)) {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'agent_reply.blocked_window_expired',
          resourceType: 'ticket',
          resourceId: ticketId,
          after: { content, lastCustomerMessageAt: lastCustomerMessage?.createdAt ?? null },
        },
      });
      return { error: t('errorWindowExpired') };
    }

    const rateLimit = checkOutboundRateLimit(companyId, userId);
    if (!rateLimit.allowed) {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'agent_reply.blocked_rate_limit',
          resourceType: 'ticket',
          resourceId: ticketId,
          after: { content, reason: rateLimit.reason },
        },
      });
      return { error: t('errorRateLimited') };
    }

    const moderationAllowed = await moderateAgentReply(content);
    if (!moderationAllowed) {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'agent_reply.blocked_moderation',
          resourceType: 'ticket',
          resourceId: ticketId,
          after: { content },
        },
      });
      return { error: t('errorModerationBlocked') };
    }
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
    await sendWhatsAppMessage(toWhatsAppPhone(ticket.customer.phone), content, resolveWhatsAppCredentials(ticket.company));
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
