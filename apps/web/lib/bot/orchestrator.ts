import { prisma } from '@zappy/db';
import { streamGeminiCompletion, suggestQuickReplies } from '../ai/gemini';
import type { ChatMessage, ToolCall } from '../ai/types';
import { scrubForLog } from '../pii/scrubber';
import { checkRateLimit } from './rate-limit';
import {
  assertNoCrossTenantLeak,
  checkCompanyActive,
  checkMaliciousContent,
  checkTicketContext,
  detectHallucination,
  resolveLanguage,
} from './guardrails';
import { appendMessage, findOrCreateCustomer, findOrCreateOpenTicket, loadHistory } from './conversation';
import { BUSINESS_TOOLS, executeBusinessTool } from './tool-definitions';

export class OrchestratorBlockedError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'OrchestratorBlockedError';
  }
}

export interface OrchestrateInput {
  // The widget only ever knows the company by its public slug, never the
  // internal UUID — despite the wire field being named `companyId`.
  companySlug: string;
  conversationId: string;
  message: string;
}

export interface OrchestrateResult {
  quickReplies: string[];
}

const FALLBACK_MESSAGE =
  'Desculpa, não consegui processar isso agora. Pode tentar reformular ou pedir pra falar com um atendente?';

// G9 — at most two business-tool rounds, then a forced final-answer round.
// Started at 1 (round 1: tool, round 2: text only) per the original spec's
// anti-loop rule; raised to 2 after finding a real hallucination it caused:
// when a customer combines service + date in one message (e.g. "quero
// agendar a tosa dia 9"), the model reasonably spends its one tool call
// confirming the service name (list_services) first, then — forced straight
// to text with no availability data — improvised availability-sounding text
// it never actually checked. Two rounds lets the natural chain (verify
// service, then check_availability) complete in the same turn when needed,
// while still being a small bounded constant, not an unbounded loop.
const MAX_TOOL_ROUNDS = 2;

export async function* orchestrate(
  input: OrchestrateInput,
): AsyncGenerator<string, OrchestrateResult, unknown> {
  console.log(`[chat] company=${input.companySlug} message="${scrubForLog(input.message)}"`);

  const company = await prisma.company.findUnique({ where: { slug: input.companySlug } });
  if (!company) throw new OrchestratorBlockedError('company_not_found');

  const g4 = checkCompanyActive(company);
  if (!g4.allowed) throw new OrchestratorBlockedError(g4.reason!);

  const rl = checkRateLimit(company.id, input.conversationId);
  if (!rl.allowed) throw new OrchestratorBlockedError('rate_limited');

  const g3 = checkMaliciousContent(input.message);
  if (!g3.allowed) throw new OrchestratorBlockedError(g3.reason!);

  const customer = await findOrCreateCustomer(company.id, input.conversationId);
  const ticket = await findOrCreateOpenTicket(company.id, customer.id);

  const g5 = checkTicketContext(ticket);
  if (!g5.allowed) throw new OrchestratorBlockedError(g5.reason!);

  assertNoCrossTenantLeak(ticket, company.id);

  const history = await loadHistory(ticket.id);
  await appendMessage(ticket.id, company.id, 'customer', input.message);

  const language = resolveLanguage(company);
  const config = company.config as { botName?: string } | null;
  const botName = config?.botName ?? 'Assistente';
  // UTC "today", consistent with services.ts treating businessHours/slots as
  // UTC throughout (see checkAvailability) — real per-company timezone
  // support is a follow-up, not done here.
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const todayWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(today);
  const systemPrompt = [
    `Você é ${botName}, o assistente de suporte da empresa ${company.name}.`,
    `Responda sempre em ${language}, de forma clara, direta e simpática.`,
    `Hoje é ${todayWeekday}, ${todayIso} (formato YYYY-MM-DD).`,
    'Se não souber a resposta com certeza, diga que vai encaminhar para um atendente humano — nunca invente informações.',
    'Você tem acesso a tools para listar serviços, checar disponibilidade, criar agendamentos e listar perguntas frequentes (FAQ).',
    'REGRA DE PRIORIDADE PARA FAQ x SERVIÇOS: se a pergunta do cliente for sobre quais serviços existem, preços, duração, disponibilidade de horários, OU sobre como agendar / marcar um horário (de qualquer forma, mesmo genérica como "como agendar?" ou "como funciona o agendamento?"), chame list_services (e check_availability se já tiver um serviço e data) IMEDIATAMENTE — NUNCA chame list_faqs nesse caso, mesmo que a pergunta pareça uma "dúvida geral". Só depois de excluir esses casos é que list_faqs entra em jogo.',
    'Para qualquer OUTRA pergunta geral sobre a empresa que não seja sobre o catálogo de serviços ou sobre agendar (ex: horário de funcionamento, formas de pagamento, endereço, políticas), ou quando o cliente disser que tem dúvidas de forma genérica / pedir para ver o FAQ, chame list_faqs IMEDIATAMENTE para conferir se já existe uma resposta cadastrada — nunca responda esse tipo de pergunta de memória sem checar list_faqs primeiro. Nunca invente perguntas ou respostas que não estejam na lista retornada. Se a lista vier vazia, diga que ainda não há FAQ cadastrado e ofereça encaminhar para um atendente.',
    'Se o cliente pediu pra ver as dúvidas de forma genérica (sem uma pergunta específica em mente), responda de forma breve tipo "Aqui estão algumas perguntas frequentes, clique em uma pra ver a resposta:" SEM listar as perguntas e respostas no texto — elas já aparecem automaticamente como botões pro cliente clicar, um por pergunta.',
    'Se a mensagem do cliente já é (ou é muito parecida com) uma das perguntas retornadas por list_faqs — por exemplo, se ele clicou em um dos botões de pergunta — responda diretamente com a resposta exata dessa pergunta específica, sem listar as outras de novo.',
    'Nunca diga que um agendamento foi confirmado sem antes ter chamado create_booking e recebido sucesso — nunca invente horários, preços ou confirmações.',
    'As tools de agendamento identificam o serviço pelo nome exato (igual ao que list_services retornou), nunca por um id. Se não tiver certeza do nome exato do serviço mencionado pelo cliente, chame list_services de novo para confirmar antes de checar disponibilidade ou criar o agendamento.',
    'Quando o cliente mencionar uma data relativa ou parcial (ex: "dia 9", "amanhã", "sexta-feira", "essa semana"), calcule você mesmo a data exata no formato YYYY-MM-DD usando a data de hoje acima como referência — nunca peça pro cliente reescrever a data nesse formato. Se o cliente disser só o dia do mês (ex: "dia 9") e esse dia já passou no mês atual, assuma o próximo mês; se ainda não passou, assuma o mês atual.',
    'Quando check_availability retornar horários (morningSlots/afternoonSlots), NÃO liste os horários no texto da sua resposta — eles já aparecem automaticamente como botões pro cliente clicar. Só confirme brevemente que encontrou horários de manhã e/ou tarde e pergunte qual ele prefere.',
    'Quando o cliente responder com um horário curto (ex: "09:00"), esse é um horário que veio dos botões do último check_availability, e combina com a data já estabelecida na conversa. Nome completo e telefone com DDD do cliente são OBRIGATÓRIOS para criar o agendamento — se ainda não tiver os dois, peça-os agora antes de chamar create_booking (não invente, não assuma). Assim que tiver o horário, a data, o nome E o telefone, chame create_booking IMEDIATAMENTE usando o "iso" correspondente a esse horário no resultado de check_availability mais recente, sem pedir mais nenhuma confirmação.',
    'Quando o cliente pedir para ver serviços, horários disponíveis ou quiser agendar, chame a tool correspondente IMEDIATAMENTE nesta mesma resposta — nunca diga "vou verificar" ou peça confirmação antes de chamar a tool, apenas chame.',
    'Ao confirmar um agendamento, nunca exiba o bookingId interno pro cliente — mencione só o serviço, data, hora e preço.',
    'O resultado de create_booking pode vir com "requiresManualConfirmation": true. Se vier true, NÃO diga que o agendamento está confirmado — diga que o horário foi reservado e que alguém do time vai entrar em contato pelo telefone informado pelo cliente para confirmar o agendamento e os detalhes do serviço. Se vier false (ou ausente), confirme normalmente que o agendamento está confirmado.',
  ].join(' ');

  let currentMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: input.message },
  ];

  let full = '';
  let toolsForThisRound = BUSINESS_TOOLS;
  let toolRoundsUsed = 0;
  const toolNamesUsed: string[] = [];
  let slotButtons: string[] = [];
  let faqButtons: string[] = [];
  let serviceButtons: string[] = [];

  for (;;) {
    const gen = streamGeminiCompletion(currentMessages, toolsForThisRound);
    let toolCalls: ToolCall[] | null = null;

    for (;;) {
      const next = await gen.next();
      if (next.done) {
        toolCalls = next.value.toolCalls;
        break;
      }
      full += next.value;
      yield next.value;
    }

    if (!toolCalls || toolCalls.length === 0) break; // final text answer, we're done

    if (toolRoundsUsed >= MAX_TOOL_ROUNDS) break; // G9: force stop, use whatever text we have

    toolRoundsUsed++;
    // One tool call per round, per the original spec's anti-chain rule — even
    // if the model asked for more than one in a single response, only the
    // first is executed. Up to MAX_TOOL_ROUNDS rounds are still allowed
    // (chaining across rounds, e.g. list_services then check_availability).
    const toolCall = toolCalls[0]!;
    toolNamesUsed.push(toolCall.name);
    const toolResultContent = await executeBusinessTool(toolCall, {
      companyId: company.id,
      ticketId: ticket.id,
      customerId: customer.id,
    });

    if (toolCall.name === 'check_availability') {
      // The model gets the full JSON (with ISO datetimes) via the 'tool'
      // message below; the buttons themselves only need the short "HH:MM"
      // labels the customer actually clicks.
      try {
        const parsed = JSON.parse(toolResultContent) as {
          morningSlots?: { time: string }[];
          afternoonSlots?: { time: string }[];
        };
        slotButtons = [...(parsed.morningSlots ?? []), ...(parsed.afternoonSlots ?? [])].map((s) => s.time);
      } catch {
        slotButtons = [];
      }
    }

    if (toolCall.name === 'list_services') {
      // One button per real, active service name — the customer picks a
      // service by clicking instead of typing it, same pattern as slots/FAQ.
      try {
        const parsed = JSON.parse(toolResultContent) as { name: string }[];
        serviceButtons = parsed.map((s) => s.name);
      } catch {
        serviceButtons = [];
      }
    }

    if (toolCall.name === 'list_faqs') {
      // Same idea as slotButtons: one button per real, cadastrado question —
      // clicking one sends that exact question text back as the next
      // message, which the model then matches against this same list to
      // answer with just that FAQ's stored answer.
      try {
        const parsed = JSON.parse(toolResultContent) as { question: string }[];
        faqButtons = parsed.map((f) => f.question);
      } catch {
        faqButtons = [];
      }
    }

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: null, toolCalls: [toolCall] },
      { role: 'tool', content: toolResultContent, toolCallId: toolCall.id, name: toolCall.name },
    ];
    // Tools stay available for the next round until the round cap is hit —
    // only then is the model forced to answer in text with no more tools.
    toolsForThisRound = toolRoundsUsed >= MAX_TOOL_ROUNDS ? [] : BUSINESS_TOOLS;
    full = ''; // discard anything from the tool-call round (there shouldn't be real content alongside a tool call)
  }

  if (!full.trim()) {
    full = FALLBACK_MESSAGE;
    yield full;
  }

  detectHallucination(); // G8 — see guardrails.ts for current scope

  let quickReplies = await suggestQuickReplies(input.message, full);

  if (slotButtons.length > 0) {
    // Full override, not merged with the free-form suggestions: these are
    // the only real available times (straight from check_availability), so
    // mixing in a generic guess here would risk offering a time that isn't
    // actually free. Up to 3 manhã + 3 tarde, already capped in services.ts.
    // Takes priority over serviceButtons since a chained turn (list_services
    // then check_availability) means the customer already has a concrete
    // service+date and is now down to picking a time.
    quickReplies = slotButtons;
  } else if (serviceButtons.length > 0) {
    // Real service names to pick from — replaces the old weaker "just
    // prepend a generic Quero agendar chip" approach with actual clickable
    // options, straight from list_services.
    quickReplies = serviceButtons;
  } else if (faqButtons.length > 0) {
    // Same reasoning — real cadastrado questions, not a generic guess.
    quickReplies = faqButtons;
  }

  await appendMessage(ticket.id, company.id, 'bot', full);

  return { quickReplies };
}
