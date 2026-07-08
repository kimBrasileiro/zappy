export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string — parsed by the caller once the tool is executed
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  toolCalls?: ToolCall[]; // present on assistant messages that decided to call tools
  toolCallId?: string; // present on 'tool' role messages — which call this is a result for
  name?: string; // tool name, present on 'tool' role messages
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export type StreamResult = { toolCalls: ToolCall[] } | { toolCalls: null };
