import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatMessage, StreamResult, ToolDefinition } from './types';

// Gemini via its OpenAI-compatible endpoint — lets this adapter (and the
// FailoverManager built in a later phase) treat Gemini identically to any
// other OpenAI-compat provider (Mistral, GPT), per the original pool design.
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

// Two Gemini models, not two providers — protects against a specific model
// being overloaded/rate-limited/erroring (the failure mode actually seen in
// practice), not a full outage of Gemini itself (both models share the same
// underlying API/account, so an outage there takes both down together).
// Falling back to a genuinely different provider is a real follow-up once
// there's a second provider's API key configured — there isn't one yet.
export const PRIMARY_GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
// Confirmed reachable with this project's API key/access tier — several
// other plausible-looking model names (gemini-1.5-flash, gemini-2.5-pro,
// gemini-2.0-flash-001) 404 on this same key, so don't swap this default
// without actually testing the replacement against a real key first.
export const FALLBACK_GEMINI_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash-lite';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }
  return client;
}

function toOpenAiMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m): ChatCompletionMessageParam => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId!, content: m.content ?? '' };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role as 'system' | 'user' | 'assistant', content: m.content ?? '' };
  });
}

function toOpenAiTools(tools: ToolDefinition[]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

// Yields text deltas as they stream in (true token streaming — preserved for
// the common case where the model answers directly without needing a tool).
// If the model instead decides to call one or more tools, the Gemini/OpenAI
// API sends `tool_calls` deltas instead of `content` deltas; those are
// accumulated by index (the standard OpenAI streaming tool-call shape —
// fragments could in principle arrive split across chunks, though in
// practice Gemini's OpenAI-compat endpoint sends each call whole in one
// chunk) and returned from the generator once the stream ends, rather than
// yielded, since partial tool-call JSON isn't safe to act on mid-stream.
export async function* streamGeminiCompletion(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  model: string = PRIMARY_GEMINI_MODEL,
): AsyncGenerator<string, StreamResult, unknown> {
  const stream = await getClient().chat.completions.create({
    model,
    messages: toOpenAiMessages(messages),
    tools: tools?.length ? toOpenAiTools(tools) : undefined,
    tool_choice: tools?.length ? 'auto' : undefined,
    stream: true,
    // Gemini 2.5 models think by default, and thinking tokens count against
    // the (small, default) max_tokens budget — occasionally leaving nothing
    // for the actual visible reply (empty content, finish_reason "stop", no
    // error). This bot only ever needs a direct tool call or a short reply,
    // never chain-of-thought, so disabling it outright is strictly better
    // here, not just a workaround for the empty-response bug.
    // Not in the OpenAI SDK's own ReasoningEffort union (that's "low" |
    // "medium" | "high" | null) — "none" is a Gemini-specific extension to
    // disable thinking entirely, hence the cast.
    reasoning_effort: 'none',
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);

  const toolCallsByIndex = new Map<number, { id: string; name: string; arguments: string }>();
  let sawAnyContent = false;
  let lastFinishReason: string | null | undefined;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (chunk.choices[0]?.finish_reason) lastFinishReason = chunk.choices[0].finish_reason;
    if (delta?.content) {
      sawAnyContent = true;
      yield delta.content;
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const acc = toolCallsByIndex.get(tc.index) ?? { id: '', name: '', arguments: '' };
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.name = tc.function.name;
        if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        toolCallsByIndex.set(tc.index, acc);
      }
    }
  }

  // Diagnostic for the empty-completion issue reasoning_effort: 'none' above
  // mitigates but doesn't fully eliminate — orchestrator.ts retries once on
  // this (with the fallback model, see PRIMARY_GEMINI_MODEL/
  // FALLBACK_GEMINI_MODEL above), but if it keeps showing up, this is where
  // to look.
  if (!sawAnyContent && toolCallsByIndex.size === 0) {
    console.log(`[gemini] empty stream (model=${model}) — finish_reason=${lastFinishReason}`);
  }

  if (toolCallsByIndex.size === 0) return { toolCalls: null };
  return { toolCalls: [...toolCallsByIndex.values()] };
}

const QUICK_REPLY_SYSTEM_PROMPT =
  'Você sugere respostas rápidas (quick replies) para um chat de atendimento ao cliente. ' +
  'Dada a última mensagem do cliente e a resposta do assistente, devolva um array JSON de até 4 ' +
  'strings curtas (máximo 6 palavras cada) com possíveis próximas mensagens que o cliente clicaria. ' +
  'NUNCA invente nomes de produtos, serviços, planos ou preços que não apareçam literalmente na ' +
  'resposta do assistente — isso é sempre um chute sem acesso ao catálogo real da empresa. Se a ' +
  'resposta do assistente pedir pra escolher entre opções específicas que ela mesma não listou ' +
  '(ex: "qual serviço você quer?" sem nomear nenhum), sugira só respostas genéricas de continuação ' +
  '(ex: "Quero ver as opções", "Não sei, me mostra", "Outra dúvida") em vez de adivinhar itens de catálogo. ' +
  'Se a resposta do assistente estiver perguntando EM QUE DIA o cliente quer agendar (ainda sem checar ' +
  'horários), sugira exatamente relativos fáceis de responder — "Hoje", "Amanhã", "Semana que vem" — ' +
  'nunca algo vago tipo "Mês que vem" ou uma data solta sem contexto. ' +
  'Responda APENAS com o array JSON, nada mais — sem markdown, sem explicação.';

// Best-effort and isolated from the main reply: a failure here (bad JSON,
// network error, anything) never breaks the primary response — it just
// means that turn has no suggested buttons.
export async function suggestQuickReplies(userMessage: string, botMessage: string): Promise<string[]> {
  try {
    const response = await getClient().chat.completions.create({
      model: PRIMARY_GEMINI_MODEL,
      messages: [
        { role: 'system', content: QUICK_REPLY_SYSTEM_PROMPT },
        { role: 'user', content: `Cliente: ${userMessage}\nAssistente: ${botMessage}` },
      ],
      stream: false,
      reasoning_effort: 'none', // see streamGeminiCompletion — same empty-response issue applies here
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

    const raw = response.choices[0]?.message?.content?.trim() ?? '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed: unknown = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, 4);
  } catch {
    return [];
  }
}
