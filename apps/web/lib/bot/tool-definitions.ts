import type { ToolCall, ToolDefinition } from '../ai/types';
import { checkAvailability, createBooking, listServices } from './services';
import { listFaqs } from './faqs';

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
      },
      required: ['serviceName', 'scheduledAt', 'customerName', 'customerPhone'],
    },
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
        await checkAvailability(ctx.companyId, String(args.serviceName ?? ''), String(args.date ?? '')),
      );
    case 'create_booking':
      return JSON.stringify(
        await createBooking(ctx.companyId, ctx.ticketId, ctx.customerId, {
          serviceName: String(args.serviceName ?? ''),
          scheduledAt: String(args.scheduledAt ?? ''),
          customerName: String(args.customerName ?? ''),
          customerPhone: String(args.customerPhone ?? ''),
        }),
      );
    default:
      return JSON.stringify({ error: 'unknown_tool' });
  }
}
