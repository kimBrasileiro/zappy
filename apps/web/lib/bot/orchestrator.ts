import { prisma } from '@zappigo/db';
import { FALLBACK_GEMINI_MODEL, PRIMARY_GEMINI_MODEL, streamGeminiCompletion, suggestQuickReplies } from '../ai/gemini';
import type { ChatMessage, ToolCall } from '../ai/types';
import { scrubForLog } from '../pii/scrubber';
import { checkRateLimit } from './rate-limit';
import {
  assertNoCrossTenantLeak,
  checkCompanyActive,
  checkMaliciousContent,
  checkOrigin,
  checkTicketContext,
  detectHallucination,
  isEscalated,
  isHumanActivelyHandling,
  resolveLanguage,
} from './guardrails';
import {
  appendMessage,
  findOrCreateCustomer,
  findOrCreateCustomerByPhone,
  findOrCreateOpenTicket,
  loadHistory,
} from './conversation';
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
  channel: 'site_chat' | 'whatsapp';
  // site_chat: the widget's localStorage conversationId (matched against
  // Customer.externalId). whatsapp: the customer's phone in the same local
  // (no country code) format resolveWhatsAppRoute already normalized to
  // (matched against Customer.phone) — see lib/whatsapp/client.ts#toLocalPhone.
  conversationId: string;
  message: string;
  // Browser's Origin header, site_chat only — WhatsApp has no equivalent
  // (see guardrails.ts#checkOrigin, G12).
  origin?: string | null;
  // True whenever resolveWhatsAppRoute (conversation.ts) just resolved or
  // switched which company this WhatsApp conversation is for — a Z:<slug>
  // code, an explicit company name in the text, or true first contact.
  // Skips the LLM for this one turn in favor of a fixed greeting: the whole
  // point of a switch is the customer finding out, unambiguously, which
  // company they just landed on, which an LLM-generated reply to whatever
  // they happened to type isn't guaranteed to make clear. Never set for
  // site_chat — there's no shared-number ambiguity to resolve there.
  isNewContext?: boolean;
}

export interface OrchestrateResult {
  quickReplies: string[];
  // True whenever this ticket is (now, or already was) waiting on a human —
  // either escalate_human was just called this turn, or it was called on an
  // earlier turn and the bot is staying silent (see G11 below). The widget
  // uses this to show a persistent "aguardando atendente" flag rather than
  // customers having to infer it from the bot's wording.
  escalated: boolean;
}

const FALLBACK_MESSAGE =
  'Desculpa, não consegui processar isso agora. Pode tentar reformular ou pedir pra falar com um atendente?';

// G11 — sent whenever the customer messages again after the ticket is
// already being human-handled. The widget also has a persistent "aguardando
// atendente" banner for this same state, but that alone isn't enough — a
// customer who sends another message and gets nothing back (no bubble at
// all) reasonably reads that as broken/stuck rather than "already in queue,
// keep waiting." WhatsApp has no banner equivalent at all, so for that
// channel this text is the only signal.
const STILL_ESCALATED_MESSAGE =
  'Você já está na fila de atendimento — um atendente humano vai te responder por aqui assim que possível.';

// Fixed top-level menu shown on every fresh/switched context (see
// isNewContext) instead of whatever the LLM or suggestQuickReplies would
// otherwise guess — the three things a customer actually comes to this bot
// for, always available at the very start of a conversation.
const NEW_CONTEXT_QUICK_REPLIES = ['Agendar um serviço', 'Cancelar um agendamento', 'Tenho uma dúvida'];

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

  if (input.channel === 'site_chat') {
    const g12 = checkOrigin(company, input.origin ?? null);
    if (!g12.allowed) throw new OrchestratorBlockedError(g12.reason!);
  }

  const rl = checkRateLimit(company.id, input.conversationId);
  if (!rl.allowed) throw new OrchestratorBlockedError('rate_limited');

  const g3 = checkMaliciousContent(input.message);
  if (!g3.allowed) throw new OrchestratorBlockedError(g3.reason!);

  const customer =
    input.channel === 'whatsapp'
      ? await findOrCreateCustomerByPhone(company.id, input.conversationId)
      : await findOrCreateCustomer(company.id, input.conversationId);
  const ticket = await findOrCreateOpenTicket(company.id, customer.id, input.channel);

  const g5 = checkTicketContext(ticket);
  if (!g5.allowed) throw new OrchestratorBlockedError(g5.reason!);

  assertNoCrossTenantLeak(ticket, company.id);

  const history = await loadHistory(ticket.id);
  await appendMessage(ticket.id, company.id, 'customer', input.message);

  // Fresh/switched company context — reply with a fixed greeting instead of
  // running this turn through the LLM at all, so the customer finds out,
  // unambiguously, which company they just landed on (see OrchestrateInput's
  // isNewContext and conversation.ts#resolveWhatsAppRoute). Whatever the
  // customer actually typed to trigger the switch is still logged above,
  // but is deliberately not answered here — it's picked up normally on
  // their next message once the fixed menu below has set expectations.
  if (input.isNewContext) {
    const greeting = `Olá, sou a assistente virtual da ${company.name}. Em que posso ajudar?`;
    yield greeting;
    await appendMessage(ticket.id, company.id, 'bot', greeting);
    return { quickReplies: NEW_CONTEXT_QUICK_REPLIES, escalated: isEscalated(ticket) };
  }

  // G11 — only once an agent has actually replied (in_progress) does the bot
  // go fully silent, so it never talks over a human. Merely being flagged
  // for a human (waiting_human, nobody's picked it up yet) does NOT stop the
  // bot — it keeps answering normally below, so the customer still gets
  // help while the ticket sits in the queue.
  if (isHumanActivelyHandling(ticket)) {
    yield STILL_ESCALATED_MESSAGE;
    await appendMessage(ticket.id, company.id, 'bot', STILL_ESCALATED_MESSAGE);
    return { quickReplies: [], escalated: true };
  }

  const language = resolveLanguage(company);
  const config = company.config as { botName?: string; extraInstructions?: string } | null;
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
    'Se o cliente pedir explicitamente para falar com um atendente, uma pessoa real ou suporte humano, OU se você não souber responder com certeza mesmo depois de checar list_faqs/list_services, chame a tool escalate_human IMEDIATAMENTE — nunca apenas diga que vai encaminhar sem ter chamado a tool, e nunca invente informações.',
    'Você tem acesso a tools para listar serviços, checar disponibilidade, criar agendamentos, listar perguntas frequentes (FAQ) e encaminhar para um atendente humano.',
    'REGRA DE PRIORIDADE PARA FAQ x SERVIÇOS: se a pergunta do cliente for sobre quais serviços existem, preços, duração, disponibilidade de horários, OU sobre como agendar / marcar um horário (de qualquer forma, mesmo genérica como "como agendar?" ou "como funciona o agendamento?"), chame list_services (e check_availability se já tiver um serviço e data) IMEDIATAMENTE — NUNCA chame list_faqs nesse caso, mesmo que a pergunta pareça uma "dúvida geral". Só depois de excluir esses casos é que list_faqs entra em jogo.',
    'Para qualquer OUTRA pergunta geral sobre a empresa que não seja sobre o catálogo de serviços ou sobre agendar (ex: horário de funcionamento, formas de pagamento, endereço, políticas), ou quando o cliente disser que tem dúvidas de forma genérica / pedir para ver o FAQ, chame list_faqs IMEDIATAMENTE para conferir se já existe uma resposta cadastrada — nunca responda esse tipo de pergunta de memória sem checar list_faqs primeiro. Nunca invente perguntas ou respostas que não estejam na lista retornada. Se a lista vier vazia, diga que ainda não há FAQ cadastrado e ofereça encaminhar para um atendente.',
    'Se o cliente pediu pra ver as dúvidas de forma genérica (sem uma pergunta específica em mente), responda de forma breve tipo "Aqui estão algumas perguntas frequentes, clique em uma pra ver a resposta:" SEM listar as perguntas e respostas no texto — elas já aparecem automaticamente como botões pro cliente clicar, um por pergunta.',
    'Se a mensagem do cliente já é (ou é muito parecida com) uma das perguntas retornadas por list_faqs — por exemplo, se ele clicou em um dos botões de pergunta — responda diretamente com a resposta exata dessa pergunta específica, sem listar as outras de novo.',
    'Nunca diga que um agendamento foi confirmado sem antes ter chamado create_booking e recebido sucesso — nunca invente horários, preços ou confirmações.',
    'As tools de agendamento identificam o serviço pelo nome exato (igual ao que list_services retornou), nunca por um id. Se não tiver certeza do nome exato do serviço mencionado pelo cliente, chame list_services de novo para confirmar antes de checar disponibilidade ou criar o agendamento.',
    'Use o histórico da conversa pra saber qual serviço já está em jogo — se o cliente já perguntou sobre um serviço específico (ou só existe um serviço cadastrado) e depois disser algo genérico como "quero agendar" sem repetir o nome, assuma que é esse mesmo serviço e prossiga direto (chame check_availability), em vez de perguntar de novo qual serviço ele quer. Só pergunte de novo se houver mais de um serviço relevante na conversa e não estiver claro qual deles. IMPORTANTE: toda vez que você mencionar ou assumir um serviço — inclusive quando só existe um cadastrado e você o assumiu automaticamente sem o cliente repetir o nome — inclua o NOME EXATO desse serviço na sua própria frase de resposta (ex: "Em que dia você quer agendar a Tosa?", nunca só "Em que dia você quer agendar?"). Isso é obrigatório porque as mensagens de ferramentas (tool calls) NÃO ficam salvas no histórico entre uma mensagem e outra do cliente — sua própria frase em texto é a ÚNICA coisa que sobrevive pra você lembrar depois qual serviço estava em jogo; sem isso você corre o risco de inventar um nome de serviço que nunca existiu na próxima mensagem.',
    'Quando o cliente mencionar uma data relativa ou parcial (ex: "dia 9", "amanhã", "sexta-feira", "essa semana"), calcule você mesmo a data exata no formato YYYY-MM-DD usando a data de hoje acima como referência — nunca peça pro cliente reescrever a data nesse formato. Se o cliente disser só o dia do mês (ex: "dia 9") e esse dia já passou no mês atual, assuma o próximo mês; se ainda não passou, assuma o mês atual.',
    'Interprete expressões informais de horário exatamente como trataria um clique num botão de horário — "15h", "às 15h", "3 da tarde", "meio-dia" etc. todas contam como um horário válido (15h = 15:00, meio-dia = 12:00). Combine esse horário com a data já estabelecida (da sua própria mensagem anterior, igual à regra do parágrafo seguinte) e prossiga normalmente — NUNCA pergunte a data de novo, nem reinicie a conversa do zero, só porque o cliente digitou o horário num formato diferente de "HH:MM". Se depois de montado o horário não corresponder a nenhum horário realmente livre, chame check_availability de novo pra essa mesma data e ofereça os horários reais retornados, sem perder o serviço nem a data já estabelecidos.',
    'Quando check_availability retornar horários (morningSlots/afternoonSlots), NÃO liste os horários no texto da sua resposta — eles já aparecem automaticamente como botões pro cliente clicar. Confirme brevemente MENCIONANDO A DATA exata que você acabou de checar (formato dia/mês, ex: "Encontrei horários pro dia 15/08:") e pergunte qual ele prefere — essa menção da data é obrigatória, porque as mensagens de ferramentas (tool calls) NÃO ficam salvas entre uma mensagem e outra do cliente: sua PRÓPRIA frase em texto é a única forma de lembrar depois qual data estava em jogo.',
    'Quando o cliente responder só com um horário curto (ex: "09:00"), é um horário que veio dos botões do check_availability anterior — NUNCA pergunte a data de novo nesse caso: releia sua própria mensagem anterior (a que confirmou "Encontrei horários pro dia X") pra saber qual data combina com esse horário, e monte você mesmo o horário completo em ISO 8601 juntando essa data com o horário clicado (ex: data 2026-08-15 + horário "09:00" = "2026-08-15T09:00:00"). Nome completo e telefone com DDD do cliente são OBRIGATÓRIOS para criar o agendamento — se ainda não tiver os dois, peça-os agora antes de chamar create_booking (não invente, não assuma). Assim que tiver horário, data (da sua própria mensagem anterior), nome E telefone, chame create_booking IMEDIATAMENTE com esse horário montado, sem pedir mais nenhuma confirmação.',
    'Ao perguntar em QUE DIA o cliente quer agendar (antes de chamar check_availability), prefira relativos fáceis de responder — "hoje", "amanhã", "essa semana", "semana que vem" — e nunca sugira algo vago tipo "mês que vem" ou uma data solta sem contexto: o cliente deve conseguir responder com uma palavra curta que você já sabe resolver pro formato YYYY-MM-DD.',
    'Se em algum momento você ficar em dúvida sobre o que uma mensagem curta do cliente significa (um horário, um "sim", um número solto), NUNCA reinicie a conversa do zero perguntando de novo qual serviço ele quer — releia suas PRÓPRIAS mensagens anteriores (não as do cliente) pra recuperar o serviço e a data já estabelecidos, e peça esclarecimento só sobre a parte específica que ficou confusa. Isso vale mesmo depois de um desvio no meio da conversa (ex: "não há horários livres nesse dia, quer tentar outra data?") — o serviço continua sendo o mesmo até o cliente pedir outro explicitamente.',
    'Quando o cliente pedir para ver serviços, horários disponíveis ou quiser agendar, chame a tool correspondente IMEDIATAMENTE nesta mesma resposta — nunca diga "vou verificar" ou peça confirmação antes de chamar a tool, apenas chame.',
    'Ao confirmar um agendamento, nunca exiba o bookingId interno pro cliente — mencione só o serviço, data, hora e preço.',
    'O resultado de create_booking pode vir com "requiresManualConfirmation": true. Se vier true, NÃO diga que o agendamento está confirmado — diga que o horário foi reservado e que alguém do time vai entrar em contato pelo telefone informado pelo cliente para confirmar o agendamento e os detalhes do serviço. Se vier false (ou ausente), confirme normalmente que o agendamento está confirmado.',
    'Não existe uma tool separada para "editar" um agendamento existente — se o cliente já tem um horário marcado e quer mudar de data/hora (reagendar), trate exatamente como um agendamento novo: chame check_availability pra nova data e depois create_booking normalmente. O sistema cancela o agendamento antigo automaticamente. Se o resultado de create_booking vier com "rescheduledFrom" preenchido, isso significa que um agendamento anterior desse mesmo cliente pra esse mesmo serviço foi cancelado automaticamente — avise o cliente que o horário antigo foi cancelado e o novo está confirmado (ou reservado, se requiresManualConfirmation vier true), nunca dê a entender que agora ele tem dois agendamentos.',
    'Se list_services trouxer "cancellationPolicy" pra um serviço, use esse texto exato pra responder perguntas do cliente sobre cancelamento/multa desse serviço — não invente prazos ou valores diferentes. Se não vier "cancellationPolicy", esse serviço não tem restrição: pode cancelar a qualquer momento sem multa.',
    'Alguns serviços têm mais de uma pessoa que atende (list_services retorna "staffOptions" nesses casos). Se houver staffOptions, pergunte ao cliente se ele tem preferência de profissional antes ou depois de checar disponibilidade — se ele já disser um nome, passe staffName em check_availability/create_booking; se disser "tanto faz" ou não tiver preferência, não passe staffName e deixe o sistema alocar automaticamente (o retorno de create_booking traz "staffName" com quem foi escolhido — sempre informe isso ao cliente). Se o cliente pedir um profissional específico e create_booking retornar erro "slot_unavailable" ou "staff_absent", NUNCA troque de profissional por conta própria — informe que esse horário/dia não está disponível com essa pessoa e, se a mensagem de erro mencionar outro profissional livre, pergunte se o cliente aceita trocar; só chame create_booking de novo com outro staffName se o cliente concordar.',
    // Per-company refinement on top of everything above — e.g. the "zappigo"
    // company itself (seeded in migrations/*_seed_zappigo_company) uses this
    // to override the FAQ x Serviços rule: its only cadastrado Service is a
    // free demo call, not a priced product, so pricing questions there
    // should go through list_faqs (the real R$ plans) instead of
    // list_services like a normal tenant's catalog would.
    ...(config?.extraInstructions ? [config.extraInstructions] : []),
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
  let bookingButtons: string[] = [];
  // Starts true if the ticket was already flagged before this turn (e.g.
  // escalate_human ran on an earlier message and nobody's picked it up yet)
  // — the bot keeps answering in that state (see G11 above), but the
  // escalated flag returned to the caller still needs to reflect it.
  let escalated = isEscalated(ticket);

  for (;;) {
    let toolCalls: ToolCall[] | null = null;
    let gotAnything = false;

    // Gemini occasionally streams back a completely empty round — no text
    // delta, no tool call — for no discernible reason tied to the input
    // (reproduced ~1 in 5 tries on an innocuous message), or throws outright
    // (network hiccup, that specific model overloaded/rate-limited). Not
    // worth failing the whole turn over either way: attempt 2 switches to
    // FALLBACK_GEMINI_MODEL, a different Gemini model on the same
    // account/API — covers a model-specific issue, not a full Gemini outage,
    // which would take both down together (a genuinely different provider
    // is the real fix for that, not implemented yet). Since nothing is
    // yielded until a real chunk arrives, a retry never shows the customer a
    // truncated partial reply from the failed attempt — UNLESS a chunk
    // already went out before the error hit mid-stream, in which case
    // there's nothing safe left to retry and the error just propagates.
    for (let attempt = 0; attempt < 2; attempt++) {
      const model = attempt === 0 ? PRIMARY_GEMINI_MODEL : FALLBACK_GEMINI_MODEL;
      let attemptGotAnything = false;
      try {
        const gen = streamGeminiCompletion(currentMessages, toolsForThisRound, model);
        for (;;) {
          const next = await gen.next();
          if (next.done) {
            toolCalls = next.value.toolCalls;
            break;
          }
          attemptGotAnything = true;
          gotAnything = true;
          full += next.value;
          yield next.value;
        }
      } catch (err) {
        if (attemptGotAnything) throw err;
        console.log(`[chat] model ${model} threw on attempt ${attempt + 1}/2`, err);
      }

      if (gotAnything || (toolCalls && toolCalls.length > 0)) break;
      console.log(`[chat] empty round response from ${model} (attempt ${attempt + 1}/2)`);
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

    if (toolCall.name === 'escalate_human') {
      escalated = true;
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

    if (toolCall.name === 'list_bookings') {
      // One button per upcoming confirmed booking — the label is just a
      // human-readable summary (not machine-parseable), because the exact
      // serviceName/scheduledAt cancel_booking needs are already sitting in
      // this same tool result inside conversation history; the model reads
      // those, not the button label itself.
      try {
        const parsed = JSON.parse(toolResultContent) as { bookings?: { serviceName: string; scheduledAt: string }[] };
        bookingButtons = (parsed.bookings ?? []).map(
          (b) =>
            `${b.serviceName} — ${new Date(b.scheduledAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}`,
        );
      } catch {
        bookingButtons = [];
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
    console.log(`[chat] empty final answer after tools=[${toolNamesUsed.join(', ')}]`);
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
  } else if (bookingButtons.length > 0) {
    // The customer's real upcoming bookings to choose from before
    // cancel_booking — same reasoning as slotButtons, offered instead of
    // (not merged with) the generic guess.
    quickReplies = bookingButtons;
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

  return { quickReplies, escalated };
}
