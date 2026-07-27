import type { ToolCall, ToolDefinition } from '../ai/types';
import { cancelBooking, checkAvailability, createBooking, listBookings, listServices } from './services';
import { listFaqs } from './faqs';
import { escalateToHuman } from './conversation';

export const BUSINESS_TOOLS: ToolDefinition[] = [
  {
    name: 'list_services',
    description: 'Lista os serviços ativos que a empresa oferece, com duração e preço.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_faqs',
    description: 'Lista as perguntas frequentes (FAQ) cadastradas pela empresa, com suas respostas.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'check_availability',
    description:
      'Verifica quais horários estão disponíveis para agendar um serviço numa data específica. Retorna até 3 horários de manhã e até 3 de tarde.',
    parameters: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'O nome exato do serviço, igual ao retornado por list_services',
        },
        date: {
          type: 'string',
          description:
            'Data no formato YYYY-MM-DD. Sempre resolva você mesmo datas relativas ou parciais ditas pelo cliente (ex: "dia 9", "amanhã", "sexta-feira", "essa semana") usando a data de hoje informada no prompt do sistema — nunca peça pro cliente reescrever a data nesse formato.',
        },
        staffName: {
          type: 'string',
          description:
            'Opcional. Só existe pra serviços cujo list_services trouxe "staffOptions" (equipe com mais de uma pessoa). Se o cliente já disse qual profissional prefere, passe o nome aqui pra ver só os horários dele(a). Se o cliente disse "tanto faz", NÃO preencha esse campo — os horários retornados já consideram qualquer pessoa da equipe livre.',
        },
      },
      required: ['serviceName', 'date'],
    },
  },
  {
    name: 'create_booking',
    description:
      'Cria um agendamento confirmado para o cliente. Só chame depois que o cliente confirmar um horário específico que veio de check_availability, E depois de já ter o nome completo e telefone com DDD do cliente — nunca invente um horário, nome ou telefone. Se ainda não tiver nome e telefone, peça os dois primeiro em vez de chamar essa tool.',
    parameters: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'O nome exato do serviço, igual ao retornado por list_services',
        },
        scheduledAt: { type: 'string', description: 'Data e hora em ISO 8601, ex: 2026-08-15T15:00:00' },
        customerName: { type: 'string', description: 'Nome completo do cliente — obrigatório' },
        customerPhone: { type: 'string', description: 'Telefone do cliente com DDD, ex: (11) 98765-4321 — obrigatório' },
        staffName: {
          type: 'string',
          description:
            'Opcional. Só existe pra serviços com mais de uma pessoa na equipe (staffOptions em list_services). Se o cliente escolheu um profissional específico, passe o nome exato — se der conflito, a tool rejeita em vez de trocar de profissional sozinha. Se o cliente disse "tanto faz", NÃO preencha: a tool aloca automaticamente quem estiver livre e informa quem foi escolhido no retorno.',
        },
        confirmReplaceExisting: {
          type: 'boolean',
          description:
            'Deixe de fora (ou false) na primeira tentativa, sempre. Só passe true depois que a tool retornar erro "existing_booking_conflict" (o cliente já tem outro agendamento confirmado desse mesmo serviço) E o cliente já tiver confirmado explicitamente que quer reagendar aquele agendamento pro novo horário — nunca passe true adivinhando a resposta do cliente.',
        },
      },
      required: ['serviceName', 'scheduledAt', 'customerName', 'customerPhone'],
    },
  },
  {
    name: 'list_bookings',
    description:
      'Lista os agendamentos futuros confirmados desse cliente (identificado pelo telefone da conversa). Chame antes de cancel_booking pra confirmar com o cliente qual agendamento cancelar — nunca cancele sem o cliente confirmar explicitamente qual, mesmo se só existir um.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cancel_booking',
    description:
      'Cancela um agendamento confirmado do cliente, sem criar um novo. Só chame depois que o cliente confirmar explicitamente qual agendamento cancelar (use list_bookings primeiro) — nunca invente serviceName ou scheduledAt, use exatamente os valores retornados por list_bookings. Para REAGENDAR pra outro horário (não cancelar de vez), NÃO chame essa tool — chame create_booking direto com o novo horário, que já substitui o agendamento antigo automaticamente.',
    parameters: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'Nome exato do serviço, igual ao retornado por list_bookings' },
        scheduledAt: { type: 'string', description: 'Data e hora ISO 8601 exata, igual à retornada por list_bookings' },
      },
      required: ['serviceName', 'scheduledAt'],
    },
  },
  {
    name: 'escalate_human',
    description:
      'Encaminha a conversa para um atendente humano. Chame IMEDIATAMENTE quando o cliente pedir explicitamente para falar com um atendente, uma pessoa real, ou suporte humano, ou quando você não souber resolver algo com certeza mesmo depois de checar list_faqs/list_services. Depois de chamar, diga ao cliente que um atendente vai responder em breve — o bot para de responder nessa conversa até um humano assumir ou resolver.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
];

export interface ToolExecutionContext {
  companyId: string;
  ticketId: string;
  customerId: string | null;
}

// Every result here is fed back to the model as a 'tool' message — this is
// the only source of truth the model has for what actually happened, which
// is what makes G6 ("never confirm an action that wasn't executed") real
// rather than a guess: the model literally cannot know a booking succeeded
// unless this function actually created one and said so.
export async function executeBusinessTool(toolCall: ToolCall, ctx: ToolExecutionContext): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
  } catch {
    return JSON.stringify({ error: 'invalid_arguments' });
  }

  switch (toolCall.name) {
    case 'list_services':
      return JSON.stringify(await listServices(ctx.companyId));
    case 'list_faqs':
      return JSON.stringify(await listFaqs(ctx.companyId));
    case 'check_availability':
      return JSON.stringify(
        await checkAvailability(
          ctx.companyId,
          String(args.serviceName ?? ''),
          String(args.date ?? ''),
          args.staffName ? String(args.staffName) : undefined,
        ),
      );
    case 'create_booking':
      return JSON.stringify(
        await createBooking(ctx.companyId, ctx.ticketId, ctx.customerId, {
          serviceName: String(args.serviceName ?? ''),
          scheduledAt: String(args.scheduledAt ?? ''),
          customerName: String(args.customerName ?? ''),
          customerPhone: String(args.customerPhone ?? ''),
          staffName: args.staffName ? String(args.staffName) : undefined,
          confirmReplaceExisting: args.confirmReplaceExisting === true,
        }),
      );
    case 'list_bookings':
      return JSON.stringify(await listBookings(ctx.companyId, ctx.customerId));
    case 'cancel_booking':
      return JSON.stringify(
        await cancelBooking(ctx.companyId, ctx.customerId, {
          serviceName: String(args.serviceName ?? ''),
          scheduledAt: String(args.scheduledAt ?? ''),
        }),
      );
    case 'escalate_human':
      await escalateToHuman(ctx.ticketId);
      return JSON.stringify({ success: true });
    default:
      return JSON.stringify({ error: 'unknown_tool' });
  }
}
