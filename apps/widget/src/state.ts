import type { MessageSenderType } from '@zappigo/types';

// Local shape only — reuses MessageDTO's sender/content vocabulary from
// @zappigo/types so swapping this for real ticket-backed messages later is a
// rename, not a redesign. No ticketId yet: no ticket exists until the real
// backend creates one on first message.
export interface WidgetMessage {
  id: string;
  senderType: Extract<MessageSenderType, 'customer' | 'bot' | 'agent'>;
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
  // Cursor (server createdAt, ISO) for /api/chat/poll — null means "fetch
  // from the start of this conversation". Only advances for 'agent'
  // messages; bot replies never come through the poller (see api.ts).
  lastAgentMessageAt: string | null;
  // Mirrors the ticket's waiting_human/in_progress status server-side (see
  // lib/bot/orchestrator.ts's `escalated` result field and
  // api/chat/poll/route.ts's `escalated` response field) — persisted so the
  // "aguardando atendente" banner survives a page reload, not just the
  // in-memory session that triggered the escalation.
  escalated: boolean;
}

function storageKey(companyId: string): string {
  return `zappigo:${companyId}:conversation`;
}

function createFreshState(): WidgetState {
  return {
    conversationId: crypto.randomUUID(),
    messages: [],
    hasSentFirstMessage: false,
    lastAgentMessageAt: null,
    escalated: false,
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

// Distinct from appendMessage: uses the server's own message id (rather than
// a fresh client-generated one) so a message the poll cursor re-fetches at
// the edge of its window — createdAt round-trips through JSON at
// millisecond precision, while Postgres keeps microseconds, so an exact-hit
// cursor can match again — is deduped here instead of showing twice.
export function appendAgentMessage(state: WidgetState, id: string, content: string, createdAt: string): void {
  state.lastAgentMessageAt = createdAt;
  if (state.messages.some((m) => m.id === id)) return;
  state.messages.push({ id, senderType: 'agent', content, createdAt: Date.now() });
}
