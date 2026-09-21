import { prisma } from '@zappigo/db';
import type { ToolCall, ToolDefinition } from '../ai/types';
import { normalizePhone } from './services';
import { resolvePlayerId, saveCustomerContact } from '../sports/customers';
import { listFaqs } from './faqs';
import { escalateToHuman } from './conversation';
import type { ToolExecutionContext } from './tool-definitions';
import {
  addDaysIso,
  cancelEnrollment,
  enrollInClass,
  getPlayerLevels,
  listClassSessions,
  listMyEnrollments,
  resolveClassForEnrollment,
  saveSportLevel,
  todayIso,
  type ClassSession,
} from '../sports/classes';
import { LEVEL_LABELS, SPORT_LABELS, resolveLevel, resolveSport } from '../sports/constants';
import { cancelReservation, getCourtFreeSlots, listMyReservations, reserveCourt } from '../sports/courts';
import { submitEventRequest } from '../sports/events';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SPORT_PARAM = {
  type: 'string',
  description: 'Esporte: "beach_tennis", "futevolei" ou "volei" (aceita também o nome como o cliente escreve, ex: "Beach Tennis", "Futevôlei").',
};
const LEVEL_PARAM = {
  type: 'string',
  description: 'Nível: "iniciante", "intermediario" ou "avancado" (aceita também "Iniciante", "Intermediário", "Avançado").',
};
const DATE_PARAM = {
  type: 'string',
  description:
    'Data no formato YYYY-MM-DD. Sempre resolva você mesmo datas relativas ou parciais ditas pelo cliente (ex: "amanhã", "sexta", "dia 24") usando a data de hoje do prompt — nunca peça pro cliente reescrever a data nesse formato.',
};

export const SPORTS_TOOLS: ToolDefinition[] = [
  {
    name: 'list_faqs',
    description: 'Lista as perguntas frequentes (FAQ) cadastradas pela empresa, com suas respostas.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_class_sessions',
    description:
      'Lista as aulas em grupo COM VAGA nos próximos dias (por padrão hoje + 14 dias), com quadra, horário, nível, vagas restantes e preço. Devolve também os níveis já conhecidos do aluno (playerLevels) e marca "recommended": true nas aulas do esporte cujo nível bate com o nível dele. Chame assim que souber o esporte (e o nível, se já tiver). Os horários aparecem como botões pro cliente — não recite a lista inteira no texto.',
    parameters: {
      type: 'object',
      properties: {
        sport: SPORT_PARAM,
        level: LEVEL_PARAM,
        fromDate: { ...DATE_PARAM, description: 'Opcional. Início do período (YYYY-MM-DD). Padrão: hoje.' },
        toDate: { ...DATE_PARAM, description: 'Opcional. Fim do período (YYYY-MM-DD). Padrão: 14 dias depois do início.' },
      },
      required: [],
    },
  },
  {
    name: 'enroll_in_class',
    description:
      'Reserva UMA vaga do aluno numa aula em grupo. Só chame depois que o cliente escolheu uma aula específica que veio de list_class_sessions, E depois de já ter o nome completo e o telefone com DDD — nunca invente nome, telefone, horário ou vaga. Passe sport, level, date e startTime EXATAMENTE como a aula apareceu em list_class_sessions (a aula é identificada por esses campos, não por id). Se duas quadras tiverem a mesma aula no mesmo horário a tool devolve "ambiguous_class" com as quadras — pergunte e chame de novo com courtName. NUNCA diga que a vaga está reservada sem esta tool ter retornado success.',
    parameters: {
      type: 'object',
      properties: {
        sport: SPORT_PARAM,
        level: LEVEL_PARAM,
        date: DATE_PARAM,
        startTime: { type: 'string', description: 'Horário de início da aula, HH:MM, igual ao de list_class_sessions.' },
        courtName: { type: 'string', description: 'Opcional. Nome da quadra, só quando a tool pediu (ambiguous_class).' },
        customerName: { type: 'string', description: 'Nome completo do aluno — obrigatório' },
        customerPhone: { type: 'string', description: 'Telefone do aluno com DDD, ex: (11) 98765-4321 — obrigatório' },
        playerLevel: {
          type: 'string',
          description: 'Opcional. O nível que o aluno declarou nesse esporte (iniciante/intermediario/avancado) — salva no perfil dele.',
        },
      },
      required: ['sport', 'level', 'date', 'startTime', 'customerName', 'customerPhone'],
    },
  },
  {
    name: 'list_my_enrollments',
    description:
      'Lista as vagas futuras confirmadas desse aluno (identificado pela conversa). Chame antes de cancel_enrollment pra confirmar com o cliente qual vaga cancelar.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cancel_enrollment',
    description:
      'Cancela uma vaga do aluno numa aula. Só chame depois que o cliente confirmar explicitamente qual vaga cancelar (use list_my_enrollments antes). Identifique a vaga por date e startTime, exatamente como vieram de list_my_enrollments.',
    parameters: {
      type: 'object',
      properties: {
        date: DATE_PARAM,
        startTime: { type: 'string', description: 'Horário de início da aula, HH:MM, igual ao de list_my_enrollments.' },
        courtName: { type: 'string', description: 'Opcional. Só se a tool pedir (ambiguous_enrollment).' },
      },
      required: ['date', 'startTime'],
    },
  },
  {
    name: 'save_customer_contact',
    description:
      'Grava no cadastro do cliente o que ele acabou de informar: nome, telefone com DDD e/ou e-mail. Chame IMEDIATAMENTE assim que o cliente escrever qualquer um desses dados — não espere uma reserva. O telefone é a chave do cadastro: com ele a tool reconhece um aluno que já veio antes e devolve os níveis que já conhecemos. Só passe o que o cliente realmente escreveu.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome completo, exatamente como o cliente escreveu.' },
        phone: { type: 'string', description: 'Telefone com DDD, exatamente como o cliente escreveu.' },
        email: { type: 'string', description: 'E-mail, se o cliente informou.' },
      },
    },
  },
  {
    name: 'save_player_level',
    description:
      'Salva no perfil do aluno o nível dele em um esporte. Chame assim que o cliente disser (ou confirmar) o nível dele num esporte, mesmo que ainda não vá reservar nada.',
    parameters: { type: 'object', properties: { sport: SPORT_PARAM, level: LEVEL_PARAM }, required: ['sport', 'level'] },
  },
  {
    name: 'check_court_availability',
    description:
      'Lista os horários LIVRES de quadra numa data, pra um grupo reservar a quadra só pra eles (fora das aulas em grupo). Não serve pra aulas — pra isso use list_class_sessions. Retorna os horários por quadra.',
    parameters: {
      type: 'object',
      properties: {
        date: DATE_PARAM,
        durationMinutes: { type: 'number', description: 'Duração da reserva em minutos: 60, 90 ou 120. Padrão 60.' },
        courtName: { type: 'string', description: 'Opcional. Só pra ver uma quadra específica.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'reserve_court',
    description:
      'Reserva uma quadra inteira, num horário livre, pra um grupo. Só chame depois que o cliente escolheu data e horário que vieram de check_court_availability, e já tem nome completo e telefone com DDD. Se o cliente não tem preferência de quadra, NÃO passe courtName — a tool escolhe uma livre e informa qual. NUNCA diga que reservou sem a tool retornar success. Pedidos de EVENTO (empresa/aniversário) NÃO passam por aqui — use request_event.',
    parameters: {
      type: 'object',
      properties: {
        date: DATE_PARAM,
        startTime: { type: 'string', description: 'Horário de início, HH:MM' },
        durationMinutes: { type: 'number', description: '60, 90 ou 120' },
        courtName: { type: 'string', description: 'Opcional. Só se o cliente pediu uma quadra específica.' },
        participants: { type: 'number', description: 'Opcional. Quantas pessoas vão jogar.' },
        customerName: { type: 'string', description: 'Nome completo — obrigatório' },
        customerPhone: { type: 'string', description: 'Telefone com DDD — obrigatório' },
        notes: { type: 'string', description: 'Opcional. Observação do cliente.' },
      },
      required: ['date', 'startTime', 'durationMinutes', 'customerName', 'customerPhone'],
    },
  },
  {
    name: 'list_my_court_reservations',
    description: 'Lista as reservas de quadra futuras desse cliente. Chame antes de cancel_court_reservation.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cancel_court_reservation',
    description:
      'Cancela uma reserva de quadra. Só depois do cliente confirmar qual (use list_my_court_reservations antes). Identifique a reserva por date e startTime, exatamente como vieram de lá.',
    parameters: {
      type: 'object',
      properties: {
        date: DATE_PARAM,
        startTime: { type: 'string', description: 'Horário de início da reserva, HH:MM.' },
      },
      required: ['date', 'startTime'],
    },
  },
  {
    name: 'request_event',
    description:
      'Registra um pedido de EVENTO (evento de empresa, aniversário ou outro) e encaminha pra um humano da equipe, que entra em contato. Chame quando o cliente pedir um evento — nunca tente montar preço, data ou reserva de evento sozinho. Antes de chamar, colete o nome e o telefone com DDD do cliente (e, se ele quiser dizer, data desejada, número de pessoas e detalhes). Depois de chamar, diga que a equipe vai entrar em contato em breve.',
    parameters: {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: '"empresa", "aniversario" ou "outro"' },
        dateHint: { type: 'string', description: 'Opcional. Data/horário que o cliente mencionou, como ele disse.' },
        participants: { type: 'number', description: 'Opcional. Número aproximado de pessoas.' },
        notes: { type: 'string', description: 'Opcional. Detalhes que o cliente deu (esporte, duração, o que precisa).' },
        contactName: { type: 'string', description: 'Nome de quem pede — obrigatório' },
        contactPhone: { type: 'string', description: 'Telefone com DDD — obrigatório' },
      },
      required: ['eventType', 'contactName', 'contactPhone'],
    },
  },
  {
    name: 'escalate_human',
    description:
      'Encaminha a conversa para um atendente humano. Chame IMEDIATAMENTE quando o cliente pedir explicitamente para falar com um atendente, uma pessoa real, ou suporte humano, ou quando você não souber resolver algo com certeza mesmo depois de checar list_faqs. Depois de chamar, diga ao cliente que um atendente vai responder em breve — o bot para de responder nessa conversa até um humano assumir ou resolver.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
];

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function weekdayName(dateIso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${dateIso}T12:00:00Z`));
}

function presentSession(s: ClassSession) {
  return {
    date: s.date,
    weekday: weekdayName(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    courtName: s.courtName,
    sport: s.sportLabel,
    level: s.levelLabel,
    seatsLeft: s.seatsLeft,
    capacity: s.capacity,
    price: formatPrice(s.priceCents),
    ...(s.instructorName ? { instructor: s.instructorName } : {}),
    recommended: s.matchesPlayerLevel,
  };
}

function presentPlayerLevels(levels: Awaited<ReturnType<typeof getPlayerLevels>>) {
  return Object.fromEntries(
    Object.entries(levels).map(([sport, level]) => [
      SPORT_LABELS[sport as keyof typeof SPORT_LABELS] ?? sport,
      LEVEL_LABELS[level as keyof typeof LEVEL_LABELS] ?? level,
    ]),
  );
}

function pickDate(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return DATE_RE.test(text) ? text : fallback;
}

// The model has, more than once in testing, called a booking tool with a
// plausible-looking invented name/phone (LLM placeholder people like "Ana
// Souza 11 91234-5678") instead of asking the customer. Prompt rules alone
// don't stop that, so identity-bearing tools are gated here: the phone and at
// least one name token must appear in something the customer actually wrote in
// THIS conversation (or already be on their Customer row, e.g. a WhatsApp
// number) — otherwise the call is refused and the model is told to ask.
function foldText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

async function contactWasProvided(
  ctx: ToolExecutionContext,
  name: string,
  phone: string,
  opts: { requireBoth?: boolean } = {},
): Promise<boolean> {
  const requireBoth = opts.requireBoth ?? true;
  const normalized = normalizePhone(phone);
  if (!normalized && (requireBoth || phone)) return true; // malformed phone is reported by the domain function itself, with its own message
  const [customer, messages] = await Promise.all([
    ctx.customerId ? prisma.customer.findUnique({ where: { id: ctx.customerId }, select: { name: true, phone: true } }) : null,
    prisma.message.findMany({ where: { ticketId: ctx.ticketId, senderType: 'customer' }, select: { content: true } }),
  ]);
  const typed = messages.map((m) => m.content).join('\n');

  const phoneOk = !!normalized && (customer?.phone === normalized || typed.replace(/\D/g, '').includes(normalized));
  const foldedTyped = foldText(typed);
  const tokens = foldText(name).split(/[^a-z]+/).filter((t) => t.length >= 3);
  const nameOk =
    tokens.some((t) => foldedTyped.includes(t)) || (!!customer?.name && foldText(customer.name).trim() === foldText(name).trim());
  if (requireBoth) return phoneOk && nameOk;
  // Partial save: each field given must be backed by something typed.
  return (!phone || phoneOk) && (!name || nameOk);
}

const CONTACT_NOT_PROVIDED = JSON.stringify({
  error: 'contact_not_provided',
  message:
    'O cliente ainda não informou o nome completo e o telefone com DDD nesta conversa. Peça os dois agora e só chame a tool de novo com o que ele escrever — nunca use nomes ou telefones de exemplo ou inventados.',
});

export async function executeSportsTool(toolCall: ToolCall, rawCtx: ToolExecutionContext): Promise<string> {
  // A phone-less widget session that already gave its phone is the same person
  // as the row owning that phone — every tool below works on that row.
  const ctx = { ...rawCtx, customerId: await resolvePlayerId(rawCtx.customerId) };
  let args: Record<string, unknown>;
  try {
    args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
  } catch {
    return JSON.stringify({ error: 'invalid_arguments' });
  }

  switch (toolCall.name) {
    case 'list_faqs':
      return JSON.stringify(await listFaqs(ctx.companyId));

    case 'list_class_sessions': {
      const sport = args.sport ? resolveSport(String(args.sport)) : null;
      const level = args.level ? resolveLevel(String(args.level)) : null;
      if (args.sport && !sport) return JSON.stringify({ error: 'invalid_sport', message: 'Esporte não reconhecido — use beach_tennis, futevolei ou volei.' });
      if (args.level && !level) return JSON.stringify({ error: 'invalid_level', message: 'Nível não reconhecido — use iniciante, intermediario ou avancado.' });

      const from = pickDate(args.fromDate, todayIso());
      const to = pickDate(args.toDate, addDaysIso(from, 14));
      const { sessions, playerLevels } = await listClassSessions({
        companyId: ctx.companyId,
        fromDate: from,
        toDate: to,
        sport: sport ?? undefined,
        level: level ?? undefined,
        customerId: ctx.customerId,
        limit: 80,
      });
      const open = sessions.filter((s) => s.seatsLeft > 0);
      // Recommended (matches the player's own level for that sport) first,
      // chronological within each group — what the model should lead with.
      const ordered = [...open.filter((s) => s.matchesPlayerLevel), ...open.filter((s) => !s.matchesPlayerLevel)];
      return JSON.stringify({
        from,
        to,
        playerLevels: presentPlayerLevels(playerLevels),
        sessions: ordered.slice(0, 14).map(presentSession),
        fullSessions: sessions.length - open.length,
        note: 'Pagamento é feito no local. Vagas por aula são limitadas.',
      });
    }

    case 'enroll_in_class': {
      if (!(await contactWasProvided(ctx, String(args.customerName ?? ''), String(args.customerPhone ?? '')))) {
        return CONTACT_NOT_PROVIDED;
      }
      const resolved = await resolveClassForEnrollment(ctx.companyId, {
        sport: String(args.sport ?? ''),
        level: String(args.level ?? ''),
        date: String(args.date ?? ''),
        startTime: String(args.startTime ?? ''),
        courtName: args.courtName ? String(args.courtName) : undefined,
      });
      if ('error' in resolved) return JSON.stringify(resolved);

      const playerLevel = args.playerLevel ? resolveLevel(String(args.playerLevel)) : null;
      const result = await enrollInClass(ctx.companyId, ctx.customerId, {
        classId: resolved.classId,
        date: String(args.date),
        customerName: String(args.customerName ?? ''),
        customerPhone: String(args.customerPhone ?? ''),
        playerLevel: playerLevel ?? undefined,
      });
      if ('error' in result) {
        return JSON.stringify({
          error: result.error,
          message: result.message,
          ...(result.alternatives ? { alternatives: result.alternatives.map(presentSession) } : {}),
        });
      }
      return JSON.stringify({
        success: true,
        session: presentSession(result.session),
        playerLevel: result.playerLevel ? LEVEL_LABELS[result.playerLevel] : null,
        payment: 'Pagamento no local.',
      });
    }

    case 'list_my_enrollments': {
      const rows = await listMyEnrollments(ctx.companyId, ctx.customerId);
      return JSON.stringify({ enrollments: rows });
    }

    case 'cancel_enrollment':
      return JSON.stringify(
        await cancelEnrollment(ctx.companyId, ctx.customerId, {
          date: String(args.date ?? ''),
          startTime: String(args.startTime ?? ''),
          courtName: args.courtName ? String(args.courtName) : undefined,
        }),
      );

    case 'save_customer_contact': {
      const name = String(args.name ?? '').trim();
      const phone = String(args.phone ?? '').trim();
      const email = String(args.email ?? '').trim();
      if (!name && !phone && !email) return JSON.stringify({ error: 'invalid_input', message: 'Nenhum dado informado.' });
      // Same rule as the booking tools: only what the customer really wrote.
      if (phone || name) {
        const ok = await contactWasProvided(ctx, name, phone, { requireBoth: false });
        if (!ok) return CONTACT_NOT_PROVIDED;
      }
      if (phone && !normalizePhone(phone)) {
        return JSON.stringify({ error: 'invalid_phone', message: 'Esse telefone não parece válido — peça de novo, com DDD.' });
      }
      const saved = await saveCustomerContact(ctx.companyId, ctx.customerId, { name, phone, email });
      const levels = await getPlayerLevels(ctx.companyId, saved.customerId);
      return JSON.stringify({
        success: true,
        returningStudent: saved.merged,
        knownLevels: presentPlayerLevels(levels),
      });
    }

    case 'save_player_level': {
      const sport = resolveSport(String(args.sport ?? ''));
      const level = resolveLevel(String(args.level ?? ''));
      if (!sport || !level) return JSON.stringify({ error: 'invalid_input', message: 'Preciso de um esporte e um nível válidos.' });
      if (!ctx.customerId) return JSON.stringify({ error: 'no_customer', message: 'Não consegui identificar o aluno pra salvar o nível.' });
      await saveSportLevel(ctx.companyId, ctx.customerId, sport, level);
      return JSON.stringify({ success: true, sport: SPORT_LABELS[sport], level: LEVEL_LABELS[level] });
    }

    case 'check_court_availability': {
      const date = String(args.date ?? '');
      const result = await getCourtFreeSlots(ctx.companyId, date, {
        courtName: args.courtName ? String(args.courtName) : undefined,
        durationMinutes: typeof args.durationMinutes === 'number' ? args.durationMinutes : undefined,
      });
      if ('error' in result) return JSON.stringify(result);
      return JSON.stringify({
        ...result,
        courts: result.courts.map((c) => ({ courtName: c.courtName, freeStartTimes: c.slots.slice(0, 16) })),
      });
    }

    case 'reserve_court':
      if (!(await contactWasProvided(ctx, String(args.customerName ?? ''), String(args.customerPhone ?? '')))) {
        return CONTACT_NOT_PROVIDED;
      }
      return JSON.stringify(
        await reserveCourt(ctx.companyId, ctx.customerId, {
          date: String(args.date ?? ''),
          startTime: String(args.startTime ?? ''),
          durationMinutes: Number(args.durationMinutes ?? 0),
          courtName: args.courtName ? String(args.courtName) : undefined,
          participants: typeof args.participants === 'number' ? args.participants : undefined,
          customerName: String(args.customerName ?? ''),
          customerPhone: String(args.customerPhone ?? ''),
          notes: args.notes ? String(args.notes) : undefined,
        }),
      );

    case 'list_my_court_reservations':
      return JSON.stringify({ reservations: await listMyReservations(ctx.companyId, ctx.customerId) });

    case 'cancel_court_reservation':
      return JSON.stringify(
        await cancelReservation(ctx.companyId, ctx.customerId, {
          date: String(args.date ?? ''),
          startTime: String(args.startTime ?? ''),
        }),
      );

    case 'request_event':
      if (!(await contactWasProvided(ctx, String(args.contactName ?? ''), String(args.contactPhone ?? '')))) {
        return CONTACT_NOT_PROVIDED;
      }
      return JSON.stringify(
        await submitEventRequest(
          ctx.companyId,
          { ticketId: ctx.ticketId, customerId: ctx.customerId },
          {
            eventType: String(args.eventType ?? ''),
            dateHint: args.dateHint ? String(args.dateHint) : undefined,
            participants: typeof args.participants === 'number' ? args.participants : undefined,
            notes: args.notes ? String(args.notes) : undefined,
            contactName: String(args.contactName ?? ''),
            contactPhone: String(args.contactPhone ?? ''),
          },
        ),
      );

    case 'escalate_human':
      await escalateToHuman(ctx.ticketId);
      return JSON.stringify({ success: true });

    default:
      return JSON.stringify({ error: 'unknown_tool' });
  }
}

// Clickable options derived from a sports tool's result — same idea as the
// orchestrator's slotButtons/serviceButtons for the appointments tools: the
// customer taps a real option instead of typing it. null = this tool
// contributes no buttons.
export function sportsButtonsFor(toolName: string, resultJson: string): string[] | null {
  try {
    if (toolName === 'list_class_sessions') {
      const parsed = JSON.parse(resultJson) as {
        sessions?: { date: string; weekday: string; startTime: string; courtName: string }[];
      };
      const labels = (parsed.sessions ?? []).slice(0, 9).map((s) => {
        const [, mm, dd] = s.date.split('-');
        return `${s.weekday.slice(0, 3)} ${dd}/${mm} ${s.startTime} ${s.courtName}`;
      });
      return labels.length > 0 ? labels : null;
    }
    if (toolName === 'check_court_availability') {
      const parsed = JSON.parse(resultJson) as { courts?: { freeStartTimes: string[] }[] };
      const times = [...new Set((parsed.courts ?? []).flatMap((c) => c.freeStartTimes))].filter((t) => t.endsWith(':00')).sort();
      if (times.length === 0) return null;
      // Even sample so a wide-open day doesn't offer only the earliest hours.
      const step = Math.max(1, Math.ceil(times.length / 9));
      return times.filter((_, i) => i % step === 0).slice(0, 9);
    }
    if (toolName === 'list_my_enrollments') {
      const parsed = JSON.parse(resultJson) as { enrollments?: { whenLabel: string; courtName: string }[] };
      const labels = (parsed.enrollments ?? []).slice(0, 9).map((e) => `${e.whenLabel} ${e.courtName}`);
      return labels.length > 0 ? labels : null;
    }
  } catch {
    return null;
  }
  return null;
}
