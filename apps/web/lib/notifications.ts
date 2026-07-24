import { prisma } from '@zappy/db';
import { sendEmail } from './email/resend';
import { sendWhatsAppMessage, toWhatsAppPhone } from './whatsapp/client';
import { SUPER_ADMIN_EMAIL } from './admin-auth';

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

// Fires once per new company signup (both the email/password flow in
// (auth)/signup/actions.ts and the Google OAuth flow in
// onboarding/actions.ts create a Company the same way) — gives the platform
// operator a running signal of new customers without checking the admin
// panel proactively.
export async function notifyNewSignup(params: { companyName: string; adminEmail: string; plan: string }): Promise<void> {
  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappy] Novo cadastro — ${params.companyName}`,
    `<p>Nova empresa cadastrada: <strong>${params.companyName}</strong> (plano ${params.plan}), admin ${params.adminEmail}.</p>`,
  );
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

const BILLING_EVENT_COPY = {
  subscription_created: { customer: 'Assinatura criada', admin: 'Nova assinatura' },
  plan_changed: { customer: 'Seu plano foi alterado', admin: 'Plano alterado' },
  subscription_canceled: { customer: 'Sua assinatura foi cancelada', admin: 'Assinatura cancelada' },
  subscription_reactivated: { customer: 'Sua assinatura foi reativada', admin: 'Assinatura reativada' },
} as const;

// Fires on every billing state change (lib/stripe/client.ts#startTrialSubscription
// for creation, dashboard/billing/actions.ts for plan/cancel/reactivate) — one
// copy to the company's own admins (what changed on their account) and one to
// SUPER_ADMIN_EMAIL (so the platform operator has a running log of billing
// activity without needing to check Stripe directly for every customer).
export async function notifyBillingEvent(params: {
  companyId: string;
  event: keyof typeof BILLING_EVENT_COPY;
  planLabel: string;
}): Promise<void> {
  const company = await getActiveAdminEmails(params.companyId);
  if (!company) return;

  const copy = BILLING_EVENT_COPY[params.event];

  if (company.emails.length) {
    await sendEmail(
      company.emails,
      `${copy.customer} — Zappy`,
      `<p>${copy.customer}: plano <strong>${params.planLabel}</strong>.</p><p>Veja os detalhes em <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/billing">Assinatura</a>.</p>`,
    );
  }

  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappy] ${copy.admin} — ${company.companyName}`,
    `<p><strong>${company.companyName}</strong>: ${copy.admin.toLowerCase()}, plano <strong>${params.planLabel}</strong>.</p>`,
  );
}
