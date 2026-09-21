import { prisma } from '@zappigo/db';
import { sendEmail } from './email/resend';
import { formatDate, formatDateTime, formatTime, getDeploymentTimezone } from './format-time';
import { sendWhatsAppMessage, sendWhatsAppTemplate, toWhatsAppPhone, type ResolvedWhatsAppCredentials } from './whatsapp/client';
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
      `<p><strong>${escapeHtml(params.customerName)}</strong> (${escapeHtml(params.customerPhone)}) agendou <strong>${escapeHtml(params.serviceName)}</strong> para ${when}.</p>` +
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
  // Optional — cancelBooking (lib/bot/services.ts) always has these; a
  // future caller with no customer contact on hand (there isn't one today)
  // would just skip the WhatsApp side and keep the admin email, same as
  // before this existed.
  customerName?: string;
  customerPhone?: string; // local format, no country code — see whatsapp/client.ts#toLocalPhone
  whatsappCredentials?: ResolvedWhatsAppCredentials;
}): Promise<void> {
  const tz = getDeploymentTimezone();
  const company = await getActiveAdminEmails(params.companyId);

  if (company?.emails.length) {
    const when = formatDateTime(params.scheduledAt, 'pt-BR', tz);
    await sendEmail(
      company.emails,
      `Agendamento cancelado — ${params.serviceName}`,
      `<p>O agendamento de <strong>${escapeHtml(params.serviceName)}</strong> para ${when} foi cancelado.</p>`,
    );
  }

  // Always a template, never free text — a cancellation can be triggered by
  // staff from the dashboard long after the customer's last message, well
  // outside the 24h session window, and this must work either way without
  // this call site having to check isWithinWhatsAppSessionWindow itself.
  if (params.customerName && params.customerPhone) {
    await sendWhatsAppTemplate(
      toWhatsAppPhone(params.customerPhone),
      'booking_cancelled',
      'pt_BR',
      [params.customerName, params.serviceName, formatDate(params.scheduledAt, 'pt-BR', tz), formatTime(params.scheduledAt, 'pt-BR', tz)],
      params.whatsappCredentials,
    );
  }
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
    `<p>Nova empresa cadastrada: <strong>${escapeHtml(params.companyName)}</strong> (plano ${escapeHtml(params.plan)}), admin ${escapeHtml(params.adminEmail)}.</p>`,
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

// Sports-court modality: a company event or birthday is never booked
// automatically (see lib/sports/events.ts) — this tells the company's admins
// a person needs to follow up, with everything the customer already gave.
export async function notifyEventRequest(params: {
  companyId: string;
  ticketId: string;
  eventLabel: string;
  contactName: string;
  contactPhone: string;
  dateHint: string | null;
  participants: number | null;
  notes: string | null;
}): Promise<void> {
  const company = await getActiveAdminEmails(params.companyId);
  if (!company?.emails.length) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const rows = [
    ['Tipo', params.eventLabel],
    ['Contato', `${params.contactName} — ${params.contactPhone}`],
    ['Data/horário desejado', params.dateHint],
    ['Participantes', params.participants ? String(params.participants) : null],
    ['Detalhes', params.notes],
  ]
    .filter((row): row is [string, string] => !!row[1])
    .map(([label, value]) => `<p style="margin:0 0 8px;"><strong>${label}:</strong> ${escapeHtml(value)}</p>`)
    .join('');

  await sendEmail(
    company.emails,
    `Solicitação de evento — ${company.companyName}`,
    `<p>Chegou um pedido de evento que precisa de contato humano:</p>` +
      `<div style="background:#f8f9fb;border-radius:8px;padding:14px 18px;margin:14px 0;">${rows}</div>` +
      `<p><a href="${appUrl}/dashboard/conversations/${params.ticketId}">Abrir solicitação</a></p>`,
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

// Keys match AuditLog.action verbatim (see sendAgentReply's three write
// sites) — one shared vocabulary instead of a second parallel naming scheme.
type ModerationBlockReason = 'agent_reply.blocked_moderation' | 'agent_reply.blocked_rate_limit' | 'agent_reply.blocked_window_expired';
const MODERATION_BLOCK_REASON_LABEL: Record<ModerationBlockReason, string> = {
  'agent_reply.blocked_moderation': 'política de conteúdo (WABA ban-risk)',
  'agent_reply.blocked_rate_limit': 'limite de envio',
  'agent_reply.blocked_window_expired': 'janela de 24h do WhatsApp expirada',
};

// Fires on every blocked agent-composed WhatsApp reply (see dashboard/
// conversations/[ticketId]/actions.ts#sendAgentReply's three AuditLog write
// sites) — same "find out immediately, not just via the admin panel"
// reasoning as notifyQuotaWarning above, but per-event rather than a
// once-a-month threshold: any single block is a signal one of Zappigo's own
// customers might be risking the shared WABA (or just hit a real technical
// wall like the 24h window), worth knowing about as it happens, not just
// when someone happens to check /admin/moderation.
export async function notifyModerationBlock(params: {
  companyName: string;
  ticketId: string;
  reason: ModerationBlockReason;
  content: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const reasonLabel = MODERATION_BLOCK_REASON_LABEL[params.reason];
  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappigo] Mensagem bloqueada — ${params.companyName}`,
    `<p><strong>${escapeHtml(params.companyName)}</strong> teve uma resposta de atendente bloqueada — motivo: <strong>${escapeHtml(reasonLabel)}</strong>.</p>` +
      `<p>Conteúdo bloqueado: <em>"${escapeHtml(params.content)}"</em></p>` +
      `<p><a href="${appUrl}/admin/moderation">Ver painel de moderação</a></p>`,
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
      `<p>${copy.customer}: plano <strong>${escapeHtml(params.planLabel)}</strong>.</p><p>Veja os detalhes em <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/billing">Assinatura</a>.</p>`,
    );
  }

  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappigo] ${copy.admin} — ${company.companyName}`,
    `<p><strong>${escapeHtml(company.companyName)}</strong>: ${copy.admin.toLowerCase()}, plano <strong>${escapeHtml(params.planLabel)}</strong>.</p>`,
  );
}
