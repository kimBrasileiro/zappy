import { Prisma, prisma } from '@zappigo/db';
import type { Company, Customer } from '@zappigo/db';
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

// An "open" ticket left untouched for 4h+ is treated as abandoned, not a
// still-ongoing conversation — applies to both channels (whichever `channel`
// the caller passes). Most relevant for one that got escalated
// (waiting_human/in_progress) and never resolved: without this, a customer
// messaging again days later would land straight in that stale escalated
// state (or stuck behind isHumanActivelyHandling) instead of getting a
// fresh bot conversation.
const STALE_TICKET_MS = 4 * 60 * 60_000;

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

  if (existing) {
    const isStale = Date.now() - existing.updatedAt.getTime() > STALE_TICKET_MS;
    if (!isStale) return existing;
    await prisma.ticket.update({
      where: { id: existing.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }

  return prisma.ticket.create({
    data: { companyId, customerId, channel, status: 'bot_active' },
  });
}

export type WhatsAppRouteResult =
  | { needsCode: true }
  // A returning number sent a bare "oi"/"olá" with no real request, and the
  // last conversation with it (if any) has gone stale — see isBareGreeting/
  // hasActiveConversation below. Nothing is created yet (no ticket, no
  // message); the caller sends a plain confirmation text and waits for the
  // customer's actual reply before this turns into a real conversation.
  | { needsCode: false; needsConfirmation: true; company: Company }
  // isSwitch: true whenever this turn just (re)resolved which company the
  // conversation is for — a Z:<slug> code, an explicit company name in the
  // text, or true first contact — as opposed to simply continuing an
  // already-established route. The caller uses this to skip the LLM for
  // this one turn and reply with a fixed greeting instead (see
  // orchestrator.ts's isNewContext) — the point of the whole one-shared-
  // number multi-tenant setup is that the customer always finds out, in
  // plain terms, which company they just landed on.
  | { needsCode: false; needsConfirmation?: false; company: Company; customer: Customer; message: string; isSwitch: boolean };

// Case- and accent-insensitive substring match — same reasoning as
// lib/bot/services.ts's copy (kept separate rather than shared: this module
// matches company names, that one matches service/staff names, different
// enough domains that a shared helper wasn't worth the indirection).
function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// A message that's ONLY a greeting, nothing else — "Olá", "oi!", "bom dia"
// — as opposed to "Olá, quero agendar..." (that has real content, goes
// straight to the existing company like any other message). Deliberately a
// small fixed list rather than a loose heuristic: the only thing this gates
// is whether to ask "ainda é com a <empresa>?" before resuming, so a false
// negative just means that confirmation gets skipped (harmless — same as
// today's behavior) rather than firing on real requests by mistake.
const GREETING_WORDS = new Set(['oi', 'ola', 'opa', 'eai', 'e ai', 'bom dia', 'boa tarde', 'boa noite']);

function isBareGreeting(text: string): boolean {
  const normalized = normalizeForMatch(text).replace(/[!?.,;:]+$/g, '').trim();
  return GREETING_WORDS.has(normalized);
}

// Whether this phone number is already mid-conversation with `company` —
// i.e. findOrCreateOpenTicket (below) would hand back an existing ticket
// rather than starting a fresh one. Read-only twin of that function's own
// staleness check, kept in sync with the same STALE_TICKET_MS: a route that
// exists but hasn't been used in 4h+ is exactly the case where a bare
// greeting should confirm which company it's for, not silently resume one
// the customer may not even remember reaching out to.
async function hasActiveConversation(companyId: string, customerId: string, channel: string): Promise<boolean> {
  const existing = await prisma.ticket.findFirst({
    where: { companyId, customerId, channel, status: { notIn: ['resolved', 'closed'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!existing) return false;
  return Date.now() - existing.updatedAt.getTime() <= STALE_TICKET_MS;
}

// The whole platform shares ONE WhatsApp Business number, so a raw inbound
// phone number alone doesn't say which company the message is for. Three
// ways to resolve it, in priority order:
//   1. Explicit "Z:<company-slug>" prefix — legacy code-based switch, kept
//      for anything still generating it. Always wins, even over an existing
//      route.
//   2. A company explicitly named in the text — either the widget/dashboard
//      WhatsApp button's exact "Olá, gostaria de agendar serviços com
//      <empresa>" phrase (see apps/widget/src/widget.ts#openWhatsApp), or
//      any other message where exactly one active company's name/slug
//      appears (e.g. "Oi, queria falar com a Zappigo" — a cold first contact
//      who didn't come through a link). This wins over an existing route
//      whenever it names a DIFFERENT company than the one currently routed
//      — a customer clicking a different company's WhatsApp button, or
//      switching mid-conversation to talk to someone else, needs this to
//      actually follow them. It's a no-op when the named company matches
//      the existing route, so naturally mentioning your own company's name
//      doesn't reset anything.
//   3. An existing route for this phone number — most messages, once a
//      conversation is established and step 2 found nothing new. Exception:
//      a bare "oi"/"olá" with nothing else, when there's no still-active
//      conversation to resume (see isBareGreeting/hasActiveConversation) —
//      a returning number could mean any company at that point, so this
//      asks for confirmation instead of silently picking up wherever the
//      last (possibly days-old) conversation left off.
// With none of the three, there's no way to know which company a cold first
// contact is for, so the caller is told to ask for the code instead.
const WHATSAPP_CODE_PATTERN = /^Z:([a-z0-9-]+)\s*/i;
const SCHEDULE_SWITCH_PATTERN = /agendar\s+servi[cç]os?\s+com\s+["“]?([^"”.!?\n]+?)["”]?[.!?]?\s*$/i;

// whatsappPhoneId: null on both lookups below — a company that has
// connected its own dedicated number is deliberately invisible to the
// shared number's "which company did you mean" directory. Customers reach
// it exclusively through its own number now (see resolveWhatsAppRoute's
// dedicatedCompany short-circuit); naming it by text to the SHARED number
// must never route there instead, or the two identities would blend on
// exactly the shared thread this exclusion exists to keep separate.
async function matchCompanyByNameInText(rawText: string): Promise<Company | null> {
  const normalizedText = normalizeForMatch(rawText);
  if (normalizedText.length < 3) return null;

  const companies = await prisma.company.findMany({ where: { status: 'active', whatsappPhoneId: null } });
  const matches = companies.filter((c) => {
    const normalizedName = normalizeForMatch(c.name);
    const normalizedSlug = normalizeForMatch(c.slug);
    return (
      (normalizedName.length >= 3 && normalizedText.includes(normalizedName)) ||
      (normalizedSlug.length >= 3 && normalizedText.includes(normalizedSlug))
    );
  });

  return matches.length === 1 ? matches[0]! : null;
}

// Resolves a single already-isolated candidate name (e.g. the captured group
// from SCHEDULE_SWITCH_PATTERN) against the company directory — exact match
// first, then substring either direction, same shape as
// lib/bot/services.ts#resolveService's name matching.
async function resolveCompanyByName(candidate: string): Promise<Company | null> {
  const target = normalizeForMatch(candidate);
  if (!target) return null;

  const companies = await prisma.company.findMany({ where: { status: 'active', whatsappPhoneId: null } });
  const exact = companies.find((c) => normalizeForMatch(c.name) === target || normalizeForMatch(c.slug) === target);
  if (exact) return exact;

  return (
    companies.find((c) => {
      const normalizedName = normalizeForMatch(c.name);
      return normalizedName.length >= 3 && (normalizedName.includes(target) || target.includes(normalizedName));
    }) ?? null
  );
}

async function switchRoute(fromWaPhoneNumber: string, company: Company): Promise<Customer> {
  const customer = await findOrCreateCustomerByPhone(company.id, toLocalPhone(fromWaPhoneNumber));
  await prisma.whatsAppRoute.upsert({
    where: { waPhoneNumber: fromWaPhoneNumber },
    create: { waPhoneNumber: fromWaPhoneNumber, companyId: company.id, customerId: customer.id },
    update: { companyId: company.id, customerId: customer.id },
  });
  return customer;
}

// dedicatedCompany: resolved by the caller (api/webhooks/whatsapp/route.ts)
// from Meta's own verified `phone_number_id` metadata on this inbound
// message — the ONE signal here that can't be forged by anything a
// customer types. When set, this is an absolute, unconditional
// short-circuit: no code prefix, no name-in-text match, no existing
// WhatsAppRoute history is even consulted. A message that arrived on a
// company's own private number belongs to that company, full stop —
// exactly the guarantee "o número é privado" requires, not just the usual
// best-effort disambiguation the shared number relies on. isSwitch is
// always false here too: unlike the shared number, there's no ambiguity to
// announce with a fixed "you've reached X" greeting — the customer
// deliberately messaged this specific business's own number.
export async function resolveWhatsAppRoute(
  fromWaPhoneNumber: string,
  rawText: string,
  dedicatedCompany: Company | null = null,
): Promise<WhatsAppRouteResult> {
  if (dedicatedCompany) {
    const customer = await findOrCreateCustomerByPhone(dedicatedCompany.id, toLocalPhone(fromWaPhoneNumber));
    return { needsCode: false, company: dedicatedCompany, customer, message: rawText, isSwitch: false };
  }

  // whatsappPhoneId: null — same exclusion as matchCompanyByNameInText
  // above: a "Z:<slug>" code for a company that has since connected its own
  // number must not resolve on the shared one either. There's no legitimate
  // reason left to reach that company this way once it's gone dedicated.
  const codeMatch = rawText.match(WHATSAPP_CODE_PATTERN);
  const codeCompany = codeMatch
    ? await prisma.company.findFirst({ where: { slug: codeMatch[1]!.toLowerCase(), whatsappPhoneId: null } })
    : null;
  if (codeCompany) {
    const customer = await switchRoute(fromWaPhoneNumber, codeCompany);
    const message = rawText.slice(codeMatch![0].length).trim() || 'Olá!';
    return { needsCode: false, company: codeCompany, customer, message, isSwitch: true };
  }

  const route = await prisma.whatsAppRoute.findUnique({ where: { waPhoneNumber: fromWaPhoneNumber } });
  let [existingCompany, existingCustomer] = route
    ? await Promise.all([
        prisma.company.findUnique({ where: { id: route.companyId } }),
        prisma.customer.findUnique({ where: { id: route.customerId } }),
      ])
    : [null, null];

  // Stale route: this company used to share the platform number when this
  // WhatsAppRoute row was written, but has since connected its own
  // dedicated number. It must not still be reachable via the shared
  // number's history — delete the row (nothing left it should mean) and
  // fall through exactly as if no route existed at all.
  if (existingCompany?.whatsappPhoneId) {
    await prisma.whatsAppRoute.delete({ where: { waPhoneNumber: fromWaPhoneNumber } }).catch(() => {});
    existingCompany = null;
    existingCustomer = null;
  }

  // Company explicitly named in the text — either the widget/dashboard's
  // exact "Olá, gostaria de agendar serviços com X" button phrase, or (as a
  // more general fallback) any message where exactly one active company's
  // name/slug appears. This is checked BEFORE falling back to an existing
  // route, and wins over one whenever it names a DIFFERENT company — a
  // customer clicking a different company's WhatsApp button (or cold-
  // contacting a new one) needs the conversation to actually follow them,
  // even mid-route. It's a no-op when the named company is the one already
  // being talked to, so naturally mentioning your own company's name
  // mid-conversation doesn't reset anything.
  const switchPhraseMatch = rawText.match(SCHEDULE_SWITCH_PATTERN);
  const namedCompany = switchPhraseMatch ? await resolveCompanyByName(switchPhraseMatch[1]!) : await matchCompanyByNameInText(rawText);

  if (namedCompany && namedCompany.id !== existingCompany?.id) {
    const customer = await switchRoute(fromWaPhoneNumber, namedCompany);
    return { needsCode: false, company: namedCompany, customer, message: rawText, isSwitch: true };
  }

  if (existingCompany && existingCustomer) {
    if (isBareGreeting(rawText) && !(await hasActiveConversation(existingCompany.id, existingCustomer.id, 'whatsapp'))) {
      return { needsCode: false, needsConfirmation: true, company: existingCompany };
    }
    return { needsCode: false, company: existingCompany, customer: existingCustomer, message: rawText, isSwitch: false };
  }

  return { needsCode: true };
}

// Called by the escalate_human tool when the customer asks for a real
// person. waiting_human (rather than in_progress) distinguishes "the bot
// handed this off" from "an agent already replied" for the Inbox view. The
// bot keeps answering normally after this (see orchestrator.ts's G11), so
// escalate_human can legitimately fire again on a later message in the same
// still-open ticket — the owner-email notification is scoped to the actual
// transition into escalated, not every call, so it doesn't re-notify on
// every subsequent request for a human.
export async function escalateToHuman(ticketId: string) {
  const before = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
  const wasAlreadyEscalated = before?.status === 'waiting_human' || before?.status === 'in_progress';

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'waiting_human' },
  });
  if (!wasAlreadyEscalated) await notifyEscalation(ticket.companyId, ticket.id);
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
  // Populated by orchestrator.ts on 'bot' messages only (tokens/costUsd per
  // turn) — feeds the admin usage dashboard's per-company spend totals. See
  // Message.metadata's schema comment; this is the first real writer of it.
  metadata?: Record<string, unknown>,
) {
  return prisma.message.create({
    data: {
      ticketId,
      companyId,
      senderType,
      content,
      contentType: 'text',
      ...(metadata ? { metadata: metadata as unknown as Prisma.InputJsonValue } : {}),
    },
  });
}
