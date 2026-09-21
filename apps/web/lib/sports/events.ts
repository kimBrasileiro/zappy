import { Prisma, prisma } from '@zappigo/db';
import { normalizePhone } from '../bot/services';
import { appendMessage } from '../bot/conversation';
import { notifyEventRequest } from '../notifications';
import { saveCustomerContact } from './customers';

export const EVENT_TYPES = ['empresa', 'aniversario', 'outro'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_LABELS: Record<EventType, string> = {
  empresa: 'Evento de empresa',
  aniversario: 'Aniversário',
  outro: 'Outro evento',
};

export interface EventRequestInput {
  eventType: string;
  dateHint?: string;
  participants?: number;
  notes?: string;
  contactName: string;
  contactPhone: string;
}

export function normalizeEventType(text: string): EventType {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (t.includes('empres') || t.includes('corporat') || t.includes('confrat')) return 'empresa';
  if (t.includes('aniver') || t.includes('festa')) return 'aniversario';
  return 'outro';
}

// Company events and birthdays are never booked automatically — they need a
// person to quote/agree on the details. Both entry points (the chat's
// request_event tool and the public form's "Evento" tab) land here: the
// request is recorded on a ticket that goes straight to waiting_human, and
// the company's admins get one email with everything captured.
export async function submitEventRequest(
  companyId: string,
  ctx: { ticketId: string | null; customerId: string | null },
  input: EventRequestInput,
): Promise<{ success: true; ticketId: string } | { error: 'missing_contact_name' | 'invalid_contact_phone'; message: string }> {
  const name = input.contactName.trim();
  if (!name) return { error: 'missing_contact_name', message: 'Preciso do nome de quem está pedindo o evento.' };
  const phone = normalizePhone(input.contactPhone);
  if (!phone) return { error: 'invalid_contact_phone', message: 'Preciso de um telefone válido com DDD pra equipe entrar em contato.' };

  const eventType = normalizeEventType(input.eventType);
  const participants = input.participants && input.participants > 0 ? Math.round(input.participants) : null;
  const request = {
    eventType,
    dateHint: input.dateHint?.trim() || null,
    participants,
    notes: input.notes?.trim() || null,
    contactName: name,
    contactPhone: phone,
    requestedAt: new Date().toISOString(),
  };

  // Same phone-first identity as enrollments/reservations.
  const customerId = (await saveCustomerContact(companyId, ctx.customerId, { name, phone })).customerId;

  let ticketId = ctx.ticketId;
  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { metadata: true } });
    const metadata = { ...((ticket?.metadata as Record<string, unknown> | null) ?? {}), eventRequest: request };
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'waiting_human',
        priority: 'high',
        subject: `Solicitação de evento — ${EVENT_LABELS[eventType]}`,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    });
  } else {
    const ticket = await prisma.ticket.create({
      data: {
        companyId,
        customerId,
        channel: 'web_form',
        status: 'waiting_human',
        priority: 'high',
        subject: `Solicitação de evento — ${EVENT_LABELS[eventType]}`,
        metadata: { eventRequest: request } as unknown as Prisma.InputJsonValue,
      },
    });
    ticketId = ticket.id;
    // So the request is readable in the dashboard's conversation view, not
    // only in the email.
    await appendMessage(
      ticket.id,
      companyId,
      'customer',
      [
        `Solicitação de evento (${EVENT_LABELS[eventType]}) pelo formulário do site.`,
        request.dateHint ? `Data/horário desejado: ${request.dateHint}` : null,
        participants ? `Participantes: ${participants}` : null,
        request.notes ? `Detalhes: ${request.notes}` : null,
        `Contato: ${name} — ${phone}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  await notifyEventRequest({
    companyId,
    ticketId,
    eventLabel: EVENT_LABELS[eventType],
    contactName: name,
    contactPhone: phone,
    dateHint: request.dateHint,
    participants,
    notes: request.notes,
  });

  return { success: true, ticketId };
}
