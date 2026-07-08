import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatMessage, StreamResult, ToolDefinition } from './types';

// Gemini via its OpenAI-compatible endpoint — lets this adapter (and the
// FailoverManager built in a later phase) treat Gemini identically to any
// other OpenAI-compat provider (Mistral, GPT), per the original pool design.
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

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
): AsyncGenerator<string, StreamResult, unknown> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const stream = await getClient().chat.completions.create({
    model,
    messages: toOpenAiMessages(messages),
    tools: tools?.length ? toOpenAiTools(tools) : undefined,
    tool_choice: tools?.length ? 'auto' : undefined,
    stream: true,
  });

  const toolCallsByIndex = new Map<number, { id: string; name: string; arguments: string }>();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) yield delta.content;

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

  if (toolCallsByIndex.size === 0) return { toolCalls: null };
  return { toolCalls: [...toolCallsByIndex.values()] };
}

const QUICK_REPLY_SYSTEM_PROMPT =
  'Você sugere respostas rápidas (quick replies) para um chat de atendimento ao cliente. ' +
  'Dada a última mensagem do cliente e a resposta do assistente, devolva um array JSON de até 4 ' +
  'strings curtas (máximo 6 palavras cada) com possíveis próximas mensagens que o cliente clicaria. ' +
  'Responda APENAS com o array JSON, nada mais — sem markdown, sem explicação.';

// Best-effort and isolated from the main reply: a failure here (bad JSON,
// network error, anything) never breaks the primary response — it just
// means that turn has no suggested buttons.
export async function suggestQuickReplies(userMessage: string, botMessage: string): Promise<string[]> {
  try {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const response = await getClient().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: QUICK_REPLY_SYSTEM_PROMPT },
        { role: 'user', content: `Cliente: ${userMessage}\nAssistente: ${botMessage}` },
      ],
      stream: false,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed: unknown = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, 4);
  } catch {
    return [];
  }
}
