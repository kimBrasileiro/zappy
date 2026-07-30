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
import { pollAgentMessages, streamBotReply } from './api';
import { widgetStrings } from './i18n';

const POLL_INTERVAL_MS = 5000;

export interface WidgetConfig {
  companyId: string;
  apiUrl: string;
  primaryColor: string;
  botName: string;
  // Company.name, used to build the "Continuar no WhatsApp" button's
  // pre-filled message (see openWhatsApp) — falls back to companyId (the
  // slug) if the install snippet doesn't set data-company-name, so an old
  // snippet still produces something routable rather than breaking.
  companyName: string;
  // E.164, e.g. "+5511999999999" — the platform's shared WhatsApp number.
  // Omitted entirely (no data-whatsapp attribute) hides the button.
  whatsappNumber?: string;
  // Overrides the generic default (see quick-replies.ts) — e.g. the Zappigo
  // institutional site itself uses sales-flavored chips instead of the
  // generic "agendar um horário" ones meant for a service business.
  quickReplies?: string[];
  // Per-request override of the bot's reply language (e.g. "pt"/"es"/"en"),
  // independent of Company.config.language (that company's own default for
  // its own customers, untouched by this). Only the Zappigo marketing site
  // sets this today (data-lang, following its own locale switcher) — no
  // attribute set means undefined, so every other install is unaffected.
  language?: string;
}

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12l16-7-6 16-2.5-6.5L4 12z" fill="currentColor"/></svg>`;
const ICON_WHATSAPP = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.31A10 10 0 1 0 12 2zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.05.78.82-2.97-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.52-6.13c-.25-.12-1.47-.72-1.7-.81s-.4-.12-.56.12-.63.81-.78.97-.28.19-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.14-.25 0-.38.11-.5s.25-.29.37-.44a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.44c-.06-.12-.56-1.35-.77-1.85s-.4-.42-.56-.43h-.48a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.78 4.78 0 0 0 1 2.54 10.9 10.9 0 0 0 4.19 3.7c.58.25 1.04.4 1.4.51a3.37 3.37 0 0 0 1.54.1 2.52 2.52 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.22-.16-.47-.28z"/></svg>`;

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
  private escalatedBannerEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private quickRepliesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtnEl!: HTMLButtonElement;
  private strings: ReturnType<typeof widgetStrings>;
  private hostEl!: HTMLDivElement;

  constructor(config: WidgetConfig) {
    this.config = config;
    this.strings = widgetStrings(config.language);
    this.state = loadState(config.companyId);

    const host = document.createElement('div');
    this.hostEl = host;
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
        ${this.config.whatsappNumber ? `<button class="whatsapp" aria-label="${this.strings.continueOnWhatsApp}" title="${this.strings.continueOnWhatsApp}">${ICON_WHATSAPP}</button>` : ''}
        <button class="restart" aria-label="${this.strings.restartConversation}" title="${this.strings.restartConversation}">${ICON_RESTART}</button>
        <button class="close" aria-label="${this.strings.closeChat}">${ICON_CLOSE}</button>
      </div>
      <div class="escalated-banner"><span class="dot"></span>${this.strings.waitingForHuman}</div>
      <div class="messages"></div>
      <div class="quick-replies"></div>
      <div class="input-row">
        <input class="input" type="text" placeholder="${this.strings.messagePlaceholder}" aria-label="${this.strings.messageAriaLabel}" />
        <button class="send" aria-label="${this.strings.send}">${ICON_SEND}</button>
      </div>
      <div class="footer">${this.strings.poweredBy}</div>
    `;
    this.panelEl = panel;
    this.escalatedBannerEl = panel.querySelector('.escalated-banner')!;
    this.messagesEl = panel.querySelector('.messages')!;
    this.quickRepliesEl = panel.querySelector('.quick-replies')!;
    this.inputEl = panel.querySelector('.input')!;
    this.sendBtnEl = panel.querySelector('.send')!;

    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.setAttribute('aria-label', this.strings.openChat);
    fab.innerHTML = ICON_CHAT;
    fab.addEventListener('click', () => this.toggle());
    this.fabEl = fab;

    panel.querySelector('.close')!.addEventListener('click', () => this.toggle());
    panel.querySelector('.restart')!.addEventListener('click', () => this.resetConversation());
    panel.querySelector('.whatsapp')?.addEventListener('click', () => this.openWhatsApp());
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

  // Opens a fresh WhatsApp conversation with the platform's shared number,
  // pre-filled with an exact trigger phrase the backend recognizes (see
  // lib/bot/conversation.ts#SCHEDULE_SWITCH_PATTERN) — matching this exact
  // wording is what lets it switch/route to THIS company even when the
  // customer's phone number was already mid-conversation with a different
  // one (e.g. clicked this same button on two different clients' sites).
  // It reads to the customer as something they'd type themselves, unlike
  // the old opaque "Z:<slug>" code. This starts a NEW thread on WhatsApp —
  // it does not, and cannot, carry over this conversation's message
  // history, since WhatsApp only lets you pre-fill text the customer would
  // type themselves.
  private openWhatsApp(): void {
    if (!this.config.whatsappNumber) return;
    const digits = this.config.whatsappNumber.replace(/\D/g, '');
    const text = this.strings.whatsappGreeting(this.config.companyName);
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
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

  // Called by index.ts when the install <script> re-executes (e.g. the
  // marketing site's own locale switcher forcing a fresh mount to pick up
  // a new data-lang) — without this, the previous instance's poll
  // interval would keep running forever in the background even after its
  // DOM is gone, and a second widget would stack on top of it.
  public destroy(): void {
    this.stopPolling();
    this.hostEl.remove();
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
      const { messages, escalated } = await pollAgentMessages(
        this.config.apiUrl,
        this.config.companyId,
        conversationIdAtPoll,
        this.state.lastAgentMessageAt,
      );
      if (this.state.conversationId !== conversationIdAtPoll) return;
      // Nothing changed since last tick — skip the render/save, same as before.
      if (messages.length === 0 && escalated === this.state.escalated) return;

      for (const m of messages) {
        appendAgentMessage(this.state, m.id, m.content, m.createdAt);
      }
      this.state.escalated = escalated;
      this.renderMessages();
      saveState(this.config.companyId, this.state);
    } catch {
      // Network hiccup — the next tick retries with the same cursor.
    } finally {
      this.isPolling = false;
    }
  }

  private renderMessages(): void {
    this.escalatedBannerEl.classList.toggle('visible', this.state.escalated);

    const lastIndex = this.state.messages.length - 1;
    this.messagesEl.innerHTML = this.state.messages
      .map((m, i) => bubbleHtml(m, i === lastIndex, this.strings.agent))
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

    const quickReplies = this.config.quickReplies ?? this.strings.defaultQuickReplies;
    this.quickRepliesEl.style.display = this.state.hasSentFirstMessage ? 'none' : 'flex';
    this.quickRepliesEl.innerHTML = this.state.hasSentFirstMessage
      ? ''
      : quickReplies.map((q) => `<button class="chip">${escapeHtml(q)}</button>`).join('');
    this.quickRepliesEl.querySelectorAll('.chip').forEach((chip, i) => {
      chip.addEventListener('click', () => this.handleSend(quickReplies[i]));
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
    let escalated = this.state.escalated;

    try {
      const result = await streamBotReply(
        this.config.apiUrl,
        this.config.companyId,
        conversationIdAtSend,
        text,
        this.config.language,
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
      escalated = result.escalated;
    } catch {
      full = this.strings.fallbackReply;
    }

    // The conversation was reset while this request was in flight — this
    // reply belongs to the conversation that no longer exists, discard it
    // rather than appending it to the new, empty one.
    if (this.state.conversationId !== conversationIdAtSend) return;

    this.hideTyping();
    this.state.escalated = escalated;
    // Empty means the backend went quiet on purpose (ticket handed off to a
    // human — see orchestrator.ts's G11) rather than a real empty reply;
    // nothing to show, so no bubble — but still re-render/save so the
    // escalated banner (which may have just turned on) reflects that.
    if (full) {
      appendMessage(this.state, 'bot', full, options);
    }
    this.renderMessages();
    saveState(this.config.companyId, this.state);

    this.isBotTyping = false;
    this.sendBtnEl.disabled = false;
  }
}

function bubbleHtml(message: WidgetMessage, isLast: boolean, agentLabel: string): string {
  const label = message.senderType === 'agent' ? `<div class="msg-sender">${agentLabel}</div>` : '';
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
