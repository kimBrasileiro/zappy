export interface StreamBotReplyResult {
  fullText: string;
  options: string[];
  escalated: boolean;
}

interface ServerEvent {
  type: 'delta' | 'options' | 'done' | 'error';
  text?: string;
  options?: string[];
  escalated?: boolean;
}

// Real backend call, replacing the old mock. Uses fetch + a manually read
// ReadableStream rather than the native EventSource — EventSource only
// supports GET and can't send a JSON body. Frames are JSON-enveloped (see
// apps/web/app/api/chat/route.ts) rather than raw text, so a chunk of bot
// text containing a literal blank line can't be mistaken for a frame
// boundary.
export async function streamBotReply(
  apiUrl: string,
  companyId: string,
  conversationId: string,
  message: string,
  onChunk: (text: string) => void,
): Promise<StreamBotReplyResult> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, conversationId, message }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let options: string[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data: ')) continue;

      let event: ServerEvent;
      try {
        event = JSON.parse(line.slice('data: '.length));
      } catch {
        continue; // malformed frame — skip rather than crash the whole reply
      }

      if (event.type === 'delta' && event.text) {
        full += event.text;
        onChunk(event.text);
      } else if (event.type === 'options') {
        options = event.options ?? [];
      } else if (event.type === 'done') {
        return { fullText: full, options, escalated: event.escalated ?? false };
      } else if (event.type === 'error') {
        throw new Error('chat stream errored');
      }
    }
  }

  return { fullText: full, options, escalated: false };
}

export interface PolledAgentMessage {
  id: string;
  content: string;
  createdAt: string;
}

export interface PollResult {
  messages: PolledAgentMessage[];
  escalated: boolean;
}

// GET rather than the SSE endpoint above — this is a plain poll, not a
// streamed reply, so a simple JSON response is enough.
export async function pollAgentMessages(
  apiUrl: string,
  companyId: string,
  conversationId: string,
  after: string | null,
): Promise<PollResult> {
  const params = new URLSearchParams({ companyId, conversationId });
  if (after) params.set('after', after);
  const url = `${apiUrl.replace(/\/chat\/?$/, '/chat/poll')}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) return { messages: [], escalated: false };

  const data = (await response.json()) as { messages?: PolledAgentMessage[]; escalated?: boolean };
  return { messages: data.messages ?? [], escalated: data.escalated ?? false };
}
