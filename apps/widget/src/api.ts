export interface StreamBotReplyResult {
  fullText: string;
  options: string[];
}

interface ServerEvent {
  type: 'delta' | 'options' | 'done' | 'error';
  text?: string;
  options?: string[];
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
        return { fullText: full, options };
      } else if (event.type === 'error') {
        throw new Error('chat stream errored');
      }
    }
  }

  return { fullText: full, options };
}
