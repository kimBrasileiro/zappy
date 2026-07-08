import type { MessageSenderType } from '@chat-ia/types';

// Local shape only — reuses MessageDTO's sender/content vocabulary from
// @chat-ia/types so swapping this for real ticket-backed messages later is a
// rename, not a redesign. No ticketId yet: no ticket exists until the real
// backend creates one on first message.
export interface WidgetMessage {
  id: string;
  senderType: Extract<MessageSenderType, 'customer' | 'bot'>;
  content: string;
  createdAt: number;
  // AI-suggested quick-reply buttons for this turn (bot messages only).
  // Only ever rendered for the most recent message — see widget.ts.
  options?: string[];
}

export interface WidgetState {
  conversationId: string;
  messages: WidgetMessage[];
  hasSentFirstMessage: boolean;
}

function storageKey(companyId: string): string {
  return `chat-ia:${companyId}:conversation`;
}

function createFreshState(): WidgetState {
  return {
    conversationId: crypto.randomUUID(),
    messages: [],
    hasSentFirstMessage: false,
  };
}

export function loadState(companyId: string): WidgetState {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (raw) {
      return JSON.parse(raw) as WidgetState;
    }
  } catch {
    // localStorage unavailable (privacy mode, etc.) — fall through to fresh state.
  }
  return createFreshState();
}

export function saveState(companyId: string, state: WidgetState): void {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(state));
  } catch {
    // Ignore write failures — persistence is a nice-to-have, not required for the widget to function.
  }
}

// A brand new conversationId means the backend treats the next message as a
// completely new customer/ticket (findOrCreateCustomer matches on
// conversationId as external_id) — this is a real new session, not just a
// cleared UI.
export function resetState(companyId: string): WidgetState {
  const fresh = createFreshState();
  saveState(companyId, fresh);
  return fresh;
}

export function appendMessage(
  state: WidgetState,
  senderType: WidgetMessage['senderType'],
  content: string,
  options?: string[],
): WidgetMessage {
  const message: WidgetMessage = {
    id: crypto.randomUUID(),
    senderType,
    content,
    createdAt: Date.now(),
    options: options?.length ? options : undefined,
  };
  state.messages.push(message);
  if (senderType === 'customer') {
    state.hasSentFirstMessage = true;
  }
  return message;
}
