import { prisma } from '@zappigo/db';
import { sendEmail } from './email/resend';
import { formatDateTime, getDeploymentTimezone } from './format-time';
import { sendWhatsAppMessage, toWhatsAppPhone, type ResolvedWhatsAppCredentials } from './whatsapp/client';
import { SUPER_ADMIN_EMAIL } from './admin-auth';

// "Cliente" here is Zappigo's own customer — the company that signed up, not
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
  // Resolved by the caller (services.ts#createBooking already has the
  // company row loaded) — see resolveWhatsAppCredentials for why this
  // can't default to the shared number on its own.
  whatsappCredentials: ResolvedWhatsAppCredentials;
}): Promise<void> {
  const company = await getActiveAdminEmails(params.companyId);
  const when = formatDateTime(params.scheduledAt, 'pt-BR', getDeploymentTimezone());

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
  await sendWhatsAppMessage(toWhatsAppPhone(params.customerPhone), confirmationText, params.whatsappCredentials);
}

export async function notifyBookingCancelled(params: {
  companyId: string;
  serviceName: string;
  scheduledAt: Date;
}): Promise<void> {
  const company = await getActiveAdminEmails(params.companyId);
  if (!company?.emails.length) return;

  const when = formatDateTime(params.scheduledAt, 'pt-BR', getDeploymentTimezone());
  await sendEmail(
    company.emails,
    `Agendamento cancelado — ${params.serviceName}`,
    `<p>O agendamento de <strong>${params.serviceName}</strong> para ${when} foi cancelado.</p>`,
  );
}

// Fires once per new company signup (both the email/password flow in
// (auth)/signup/actions.ts and the Google OAuth flow in
// onboarding/actions.ts create a Company the same way) — gives the platform
// operator a running signal of new customers without checking the admin
// panel proactively.
export async function notifyNewSignup(params: { companyName: string; adminEmail: string; plan: string }): Promise<void> {
  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappigo] Novo cadastro — ${params.companyName}`,
    `<p>Nova empresa cadastrada: <strong>${params.companyName}</strong> (plano ${params.plan}), admin ${params.adminEmail}.</p>`,
  );
}

// Message.content is the customer's own free text — never trust it as safe
// HTML just because it's being dropped into an email instead of the chat
// widget (which already escapes it the same way on its own side).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ESCALATION_EXCERPT_LIMIT = 6;
const SENDER_LABELS: Record<string, string> = { bot: 'Assistente', agent: 'Atendente', system: 'Sistema' };

// Lets whoever opens the email see what the conversation is actually about
// before they even click through — same reasoning as notifyBookingCreated
// including the service/time inline rather than just "you have a booking,
// go check the dashboard."
export async function notifyEscalation(companyId: string, ticketId: string): Promise<void> {
  const company = await getActiveAdminEmails(companyId);
  if (!company?.emails.length) return;

  const [ticket, recentMessages] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId }, include: { customer: true } }),
    prisma.message.findMany({
      where: { ticketId, isInternal: false },
      orderBy: { createdAt: 'desc' },
      take: ESCALATION_EXCERPT_LIMIT,
    }),
  ]);

  const customerLabel = ticket?.customer?.name || ticket?.customer?.phone || 'O cliente';
  const excerptHtml = recentMessages
    .reverse()
    .map((m) => {
      const label = m.senderType === 'customer' ? customerLabel : (SENDER_LABELS[m.senderType] ?? m.senderType);
      return `<p style="margin:0 0 10px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(m.content)}</p>`;
    })
    .join('');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  await sendEmail(
    company.emails,
    `Conversa precisa de atenção — ${company.companyName}`,
    `<p>${escapeHtml(customerLabel)} precisa de atendimento humano. Últimas mensagens da conversa:</p>` +
      (excerptHtml
        ? `<div style="background:#f8f9fb;border-radius:8px;padding:14px 18px;margin:14px 0;">${excerptHtml}</div>`
        : '') +
      `<p><a href="${appUrl}/dashboard/conversations/${ticketId}">Abrir conversa</a></p>`,
  );
}

// Fires once per company/month, exactly when the running monthly customer-
// message count (orchestrator.ts) crosses the halfway point of that
// company's quota (see lib/bot/quota.ts) — a plain equality check against
// the count itself, not a separate "already warned" flag to keep in sync,
// since the count only ever increases by 1 per customer turn within the
// month. Lets the platform operator see a company approaching its cap (and
// the human-escalation that follows once it's hit) before the customer ever
// notices anything, instead of finding out after the fact in Admin → Gastos
// de IA.
export async function notifyQuotaWarning(params: {
  companyName: string;
  messageCount: number;
  limit: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappigo] ${params.companyName} atingiu 50% do limite mensal de IA`,
    `<p><strong>${escapeHtml(params.companyName)}</strong> já usou <strong>${params.messageCount}</strong> de <strong>${params.limit}</strong> mensagens automáticas este mês.</p>` +
      `<p>Ao atingir o limite, novas mensagens dessa empresa são encaminhadas direto pra atendimento humano em vez de continuar consumindo IA.</p>` +
      `<p><a href="${appUrl}/admin/usage">Ver gastos de IA</a></p>`,
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
      `${copy.customer} — Zappigo`,
      `<p>${copy.customer}: plano <strong>${params.planLabel}</strong>.</p><p>Veja os detalhes em <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/billing">Assinatura</a>.</p>`,
    );
  }

  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappigo] ${copy.admin} — ${company.companyName}`,
    `<p><strong>${company.companyName}</strong>: ${copy.admin.toLowerCase()}, plano <strong>${params.planLabel}</strong>.</p>`,
  );
}
