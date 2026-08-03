import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatMessage, StreamResult, ToolDefinition, UsageInfo } from './types';

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

// Google AI Studio list pricing (matches the generativelanguage.googleapis.com
// endpoint used above), USD per token — confirmed against a real metered call
// during the free-tier cost-control rollout (see orchestrator.ts's quota
// guardrail). Used only to estimate spend for the admin usage dashboard, not
// for any billing-critical path — if a model is missing here (a new one
// added without updating this table), estimateCostUsd falls back to the
// primary model's pricing rather than throwing, since an approximate number
// beats no number on that dashboard.
const GEMINI_PRICING_USD_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.15 / 1_000_000, output: 1.25 / 1_000_000 },
  'gemini-2.5-flash-lite': { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
};

export function estimateCostUsd(model: string, usage: UsageInfo): number {
  const pricing = GEMINI_PRICING_USD_PER_TOKEN[model] ?? GEMINI_PRICING_USD_PER_TOKEN[PRIMARY_GEMINI_MODEL]!;
  return usage.promptTokens * pricing.input + usage.completionTokens * pricing.output;
}

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
    // Confirmed supported on Gemini's OpenAI-compat endpoint: adds a final
    // chunk carrying real prompt/completion token counts (captured below),
    // the only source of ground-truth usage data — needed for the admin
    // per-company spend dashboard, since Gemini's own API gives no other way
    // to attribute cost to a specific call after the fact.
    stream_options: { include_usage: true },
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
  let usage: UsageInfo | null = null;

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

    // Arrives on its own final chunk (empty choices array) once the stream
    // is otherwise done, per stream_options.include_usage above.
    if (chunk.usage) {
      usage = { promptTokens: chunk.usage.prompt_tokens, completionTokens: chunk.usage.completion_tokens };
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

  if (toolCallsByIndex.size === 0) return { toolCalls: null, usage };
  return { toolCalls: [...toolCallsByIndex.values()], usage };
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

const MODERATION_SYSTEM_PROMPT =
  'Você modera mensagens que um atendente humano de uma empresa vai enviar a um cliente via WhatsApp ' +
  'Business API, verificando se a mensagem arrisca banimento do número pela Meta. Responda BLOCK se a mensagem:\n' +
  '- Menciona álcool, tabaco/cigarro, drogas, apostas/jogos de azar ou armas de qualquer forma — venda, ' +
  'promoção, ou até só confirmar que a empresa oferece algo do tipo. A Zappigo não atende negócios desses ' +
  'segmentos, então qualquer menção é tratada como fora de política, mesmo respondendo uma pergunta legítima ' +
  'do cliente.\n' +
  '- Contém conteúdo adulto/sexual explícito.\n' +
  '- É claramente uma mensagem promocional/de marketing em massa (oferta, desconto, campanha) em vez de ' +
  'uma resposta de atendimento a esse cliente específico.\n' +
  '- Contém assédio, discurso de ódio ou ameaça.\n' +
  'Uma resposta normal de atendimento — agendamento, dúvida, suporte, confirmação, até mencionar preço de ' +
  'um serviço que o próprio cliente perguntou sobre — deve SEMPRE receber ALLOW, desde que não toque nas ' +
  'categorias acima. Na dúvida sobre tom promocional (fora das categorias proibidas), responda ALLOW: o ' +
  'custo de um falso bloqueio é maior que deixar passar uma mensagem limítrofe. Responda com EXATAMENTE uma ' +
  'palavra, ALLOW ou BLOCK — nada mais.';

// Blocking gate in front of every agent-composed WhatsApp send (see
// dashboard/conversations/[ticketId]/actions.ts#sendAgentReply) — the one
// place a human, not this bot's own system-prompt-constrained replies, can
// put arbitrary text on the wire. Fails OPEN (allows the send) on any
// error/timeout/malformed response, same reasoning as suggestQuickReplies
// and the Google Calendar freebusy check in services.ts: a moderation
// hiccup must degrade to "no extra check this one time," never to "support
// can't talk to customers right now." The reason is deliberately not
// returned to the caller — this is why threat/spam/opt-in classification
// live in the system prompt above, not a UI-surfaced string.
export async function moderateAgentReply(text: string): Promise<boolean> {
  try {
    const response = await getClient().chat.completions.create({
      model: PRIMARY_GEMINI_MODEL,
      messages: [
        { role: 'system', content: MODERATION_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      stream: false,
      reasoning_effort: 'none', // see streamGeminiCompletion — same empty-response issue applies here
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

    const raw = response.choices[0]?.message?.content?.trim().toUpperCase() ?? 'ALLOW';
    return !raw.startsWith('BLOCK');
  } catch (err) {
    console.error('[gemini] moderateAgentReply failed, allowing by default', err);
    return true;
  }
}

const TRANSCRIBE_SYSTEM_PROMPT =
  'Transcreva o áudio a seguir literalmente, palavra por palavra, no idioma original em que a pessoa ' +
  'está falando. Responda APENAS com a transcrição em texto puro — sem aspas, sem comentário, sem ' +
  'markdown. Se o áudio estiver incompreensível, vazio ou não tiver fala, responda exatamente: [inaudível]';

// Deliberately NOT the OpenAI-compat client used everywhere else in this
// file — confirmed against a real WhatsApp-shaped request that the compat
// layer's input_audio only accepts format "wav"/"mp3" ("Invalid audio format
// \"ogg\"..."), while WhatsApp voice notes are always OGG/Opus. Gemini's own
// native generateContent endpoint takes the real mime_type Meta gives us
// as-is (confirmed working via a live test), so this one call goes straight
// to it instead of transcoding audio server-side just to satisfy the
// compat shim's narrower format list. thinkingConfig.thinkingBudget: 0 for
// the same reason streamGeminiCompletion sets reasoning_effort: 'none' —
// this is a short, mechanical task, thinking tokens would only add cost and
// latency here.
const GEMINI_NATIVE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Best-effort, same reasoning as suggestQuickReplies above: the caller
// (api/webhooks/whatsapp/route.ts) treats a null return as "couldn't
// understand this one," not a hard failure.
export async function transcribeAudio(
  base64: string,
  mimeType: string,
): Promise<{ text: string; costUsd: number; promptTokens: number; completionTokens: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(`${GEMINI_NATIVE_API_BASE}/models/${PRIMARY_GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TRANSCRIBE_SYSTEM_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!response.ok) {
      console.error(`[gemini] transcribeAudio failed (${response.status}): ${await response.text()}`);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text || text === '[inaudível]') return null;

    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      text,
      promptTokens,
      completionTokens,
      costUsd: estimateCostUsd(PRIMARY_GEMINI_MODEL, { promptTokens, completionTokens }),
    };
  } catch (err) {
    console.error('[gemini] transcribeAudio failed', err);
    return null;
  }
}
