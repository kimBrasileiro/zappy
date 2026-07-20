import { prisma } from '@zappy/db';
import { sendEmail } from './email/resend';
import { sendWhatsAppMessage, toWhatsAppPhone } from './whatsapp/client';

// "Cliente" here is Zappy's own customer — the company that signed up, not
// the end consumer chatting with its bot. Both notifyBookingCreated and
// notifyEscalation tell the business something needs their attention;
// there's nothing actionable in either for the end consumer.
async function getActiveAdminEmails(companyId: string): Promise<{ companyName: string; emails: string[] } | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { users: { where: { role: 'admin', status: 'active' }, select: { email: true } } },
  });
  if (!company) return null;
  return { companyName: company.name, emails: company.users.map((u) => u.email) };
}

export async function notifyBookingCreated(params: {
  companyId: string;
  serviceName: string;
  scheduledAt: Date;
  customerName: string;
  customerPhone: string; // local format, no country code — see whatsapp/client.ts#toLocalPhone
  requiresManualConfirmation: boolean;
}): Promise<void> {
  const company = await getActiveAdminEmails(params.companyId);
  // Matches the same (server-timezone, no explicit UTC label) formatting
  // already used in dashboard/bookings/page.tsx — not introducing a second
  // date-display convention on top of the existing documented timezone gap.
  const when = params.scheduledAt.toLocaleString('pt-BR');

  if (company?.emails.length) {
    await sendEmail(
      company.emails,
      `Novo agendamento — ${params.serviceName}`,
      `<p><strong>${params.customerName}</strong> (${params.customerPhone}) agendou <strong>${params.serviceName}</strong> para ${when}.</p>` +
        (params.requiresManualConfirmation
          ? '<p>Este é um pré-agendamento — a equipe precisa confirmar com o cliente.</p>'
          : ''),
    );
  }

  const confirmationText = params.requiresManualConfirmation
    ? `Olá, ${params.customerName}! Recebemos seu pedido de agendamento de ${params.serviceName} para ${when}. Nossa equipe vai entrar em contato para confirmar.`
    : `Olá, ${params.customerName}! Seu agendamento de ${params.serviceName} para ${when} está confirmado.`;
  await sendWhatsAppMessage(toWhatsAppPhone(params.customerPhone), confirmationText);
}

export async function notifyEscalation(companyId: string): Promise<void> {
  const company = await getActiveAdminEmails(companyId);
  if (!company?.emails.length) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  await sendEmail(
    company.emails,
    `Conversa precisa de atenção — ${company.companyName}`,
    `<p>Uma conversa foi encaminhada para atendimento humano.</p><p><a href="${appUrl}/dashboard/inbox">Abrir Inbox</a></p>`,
  );
}
