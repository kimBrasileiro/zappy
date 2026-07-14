import { buildStyles } from './styles';
import {
  appendAgentMessage,
  appendMessage,
  loadState,
  resetState,
  saveState,
  type WidgetMessage,
  type WidgetState,
} from './state';
import { QUICK_REPLIES } from './quick-replies';
import { pollAgentMessages, streamBotReply } from './api';

const POLL_INTERVAL_MS = 5000;

export interface WidgetConfig {
  companyId: string;
  apiUrl: string;
  primaryColor: string;
  botName: string;
}

const FALLBACK_REPLY =
  'Desculpa, tive um problema para responder agora. Tenta de novo em instantes.';

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12l16-7-6 16-2.5-6.5L4 12z" fill="currentColor"/></svg>`;

export class ChatWidget {
  private config: WidgetConfig;
  private state: WidgetState;
  private shadow: ShadowRoot;
  private isOpen = false;
  private isBotTyping = false;
  private pollTimer: number | null = null;
  private isPolling = false;

  private panelEl!: HTMLDivElement;
  private fabEl!: HTMLButtonElement;
  private messagesEl!: HTMLDivElement;
  private quickRepliesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtnEl!: HTMLButtonElement;

  constructor(config: WidgetConfig) {
    this.config = config;
    this.state = loadState(config.companyId);

    const host = document.createElement('div');
    document.body.appendChild(host);
    this.shadow = host.attachShadow({ mode: 'open' });

    this.buildDom();
    this.renderMessages();
    // A ticket only exists once the customer has sent at least one message —
    // no point polling for a conversation that doesn't have one yet.
    if (this.state.hasSentFirstMessage) this.startPolling();
  }

  private buildDom(): void {
    const style = document.createElement('style');
    style.textContent = buildStyles(this.config.primaryColor);
    this.shadow.appendChild(style);

    const root = document.createElement('div');
    root.className = 'root';

    const panel = document.createElement('div');
    panel.className = 'panel hidden';
    panel.innerHTML = `
      <div class="header">
        <div class="avatar">${this.config.botName.charAt(0).toUpperCase()}</div>
        <div class="name">${escapeHtml(this.config.botName)}</div>
        <button class="restart" aria-label="Reiniciar conversa" title="Reiniciar conversa">${ICON_RESTART}</button>
        <button class="close" aria-label="Fechar chat">${ICON_CLOSE}</button>
      </div>
      <div class="messages"></div>
      <div class="quick-replies"></div>
      <div class="input-row">
        <input class="input" type="text" placeholder="Digite sua mensagem..." aria-label="Mensagem" />
        <button class="send" aria-label="Enviar">${ICON_SEND}</button>
      </div>
      <div class="footer">Powered by Zappy</div>
    `;
    this.panelEl = panel;
    this.messagesEl = panel.querySelector('.messages')!;
    this.quickRepliesEl = panel.querySelector('.quick-replies')!;
    this.inputEl = panel.querySelector('.input')!;
    this.sendBtnEl = panel.querySelector('.send')!;

    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.setAttribute('aria-label', 'Abrir chat');
    fab.innerHTML = ICON_CHAT;
    fab.addEventListener('click', () => this.toggle());
    this.fabEl = fab;

    panel.querySelector('.close')!.addEventListener('click', () => this.toggle());
    panel.querySelector('.restart')!.addEventListener('click', () => this.resetConversation());
    this.sendBtnEl.addEventListener('click', () => this.handleSend());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSend();
    });

    root.appendChild(panel);
    root.appendChild(fab);
    this.shadow.appendChild(root);
  }

  private toggle(): void {
    this.isOpen = !this.isOpen;
    this.panelEl.classList.toggle('hidden', !this.isOpen);
    this.fabEl.classList.toggle('panel-open', this.isOpen);
    if (this.isOpen) this.inputEl.focus();
  }

  // A fresh conversationId means the backend treats the next message as a
  // genuinely new customer/ticket (see state.ts) — not just a cleared UI.
  // If a bot reply is still in flight, handleSend's own conversationId check
  // discards it instead of letting it land in the new, empty conversation.
  private resetConversation(): void {
    this.hideTyping();
    this.isBotTyping = false;
    this.sendBtnEl.disabled = false;
    this.stopPolling();
    this.state = resetState(this.config.companyId);
    this.renderMessages();
    this.inputEl.focus();
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = window.setInterval(() => this.pollOnce(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer === null) return;
    window.clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  // Picks up agent replies sent from the dashboard — the only kind of
  // message that doesn't arrive through the customer's own request/response
  // cycle (see handleSend). Runs regardless of open/closed panel state so
  // the reply is already there next time the customer opens the widget.
  private async pollOnce(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    const conversationIdAtPoll = this.state.conversationId;
    try {
      const messages = await pollAgentMessages(
        this.config.apiUrl,
        this.config.companyId,
        conversationIdAtPoll,
        this.state.lastAgentMessageAt,
      );
      if (this.state.conversationId !== conversationIdAtPoll || messages.length === 0) return;
      for (const m of messages) {
        appendAgentMessage(this.state, m.id, m.content, m.createdAt);
      }
      this.renderMessages();
      saveState(this.config.companyId, this.state);
    } catch {
      // Network hiccup — the next tick retries with the same cursor.
    } finally {
      this.isPolling = false;
    }
  }

  private renderMessages(): void {
    const lastIndex = this.state.messages.length - 1;
    this.messagesEl.innerHTML = this.state.messages
      .map((m, i) => bubbleHtml(m, i === lastIndex))
      .join('');
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Only the most recent bot message's suggested options are clickable —
    // once the conversation moves on, older suggestions are no longer valid
    // actions and are just rendered as plain text (see bubbleHtml).
    const lastMessage = this.state.messages[lastIndex];
    if (lastMessage?.senderType === 'bot' && lastMessage.options?.length) {
      this.messagesEl.querySelectorAll('.msg-options .chip').forEach((chip, i) => {
        chip.addEventListener('click', () => this.handleSend(lastMessage.options![i]));
      });
    }

    this.quickRepliesEl.style.display = this.state.hasSentFirstMessage ? 'none' : 'flex';
    this.quickRepliesEl.innerHTML = this.state.hasSentFirstMessage
      ? ''
      : QUICK_REPLIES.map((q) => `<button class="chip">${escapeHtml(q)}</button>`).join('');
    this.quickRepliesEl.querySelectorAll('.chip').forEach((chip, i) => {
      chip.addEventListener('click', () => this.handleSend(QUICK_REPLIES[i]));
    });
  }

  private showTyping(): void {
    const el = document.createElement('div');
    el.className = 'typing';
    el.id = 'cia-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private hideTyping(): void {
    this.shadow.getElementById('cia-typing')?.remove();
  }

  private async handleSend(overrideText?: string): Promise<void> {
    const text = (overrideText ?? this.inputEl.value).trim();
    if (!text || this.isBotTyping) return;

    const conversationIdAtSend = this.state.conversationId;
    this.inputEl.value = '';
    appendMessage(this.state, 'customer', text);
    this.renderMessages();
    saveState(this.config.companyId, this.state);
    this.startPolling(); // no-op if already running — a ticket exists from here on

    this.isBotTyping = true;
    this.sendBtnEl.disabled = true;
    this.showTyping();

    let liveBubble: HTMLDivElement | null = null;
    let full: string;
    let options: string[] = [];

    try {
      const result = await streamBotReply(
        this.config.apiUrl,
        this.config.companyId,
        conversationIdAtSend,
        text,
        (chunk) => {
          if (this.state.conversationId !== conversationIdAtSend) return; // reset while streaming
          if (!liveBubble) {
            this.hideTyping();
            liveBubble = document.createElement('div');
            liveBubble.className = 'bubble bot';
            this.messagesEl.appendChild(liveBubble);
          }
          liveBubble.textContent += chunk;
          this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        },
      );
      full = result.fullText;
      options = result.options;
    } catch {
      full = FALLBACK_REPLY;
    }

    // The conversation was reset while this request was in flight — this
    // reply belongs to the conversation that no longer exists, discard it
    // rather than appending it to the new, empty one.
    if (this.state.conversationId !== conversationIdAtSend) return;

    this.hideTyping();
    // Empty means the backend went quiet on purpose (ticket handed off to a
    // human — see orchestrator.ts's G11) rather than a real empty reply;
    // nothing to show, so no bubble.
    if (full) {
      appendMessage(this.state, 'bot', full, options);
      this.renderMessages();
      saveState(this.config.companyId, this.state);
    }

    this.isBotTyping = false;
    this.sendBtnEl.disabled = false;
  }
}

function bubbleHtml(message: WidgetMessage, isLast: boolean): string {
  const label = message.senderType === 'agent' ? '<div class="msg-sender">Atendente</div>' : '';
  const bubble = `${label}<div class="bubble ${message.senderType}">${escapeHtml(message.content)}</div>`;
  if (isLast && message.senderType === 'bot' && message.options?.length) {
    const chips = message.options.map((o) => `<button class="chip">${escapeHtml(o)}</button>`).join('');
    return `${bubble}<div class="msg-options">${chips}</div>`;
  }
  return bubble;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
