import { ChatWidget, type WidgetConfig } from './widget';

function readConfig(script: HTMLOrSVGScriptElement): WidgetConfig {
  const el = script as HTMLScriptElement;
  const companyId = el.dataset['company'] ?? 'unknown';
  return {
    companyId,
    // Only needed when the widget is served from a different origin than
    // the backend (the real production/CDN setup) — same-origin by default,
    // which is what the local preview page needs.
    apiUrl: el.dataset['apiUrl'] ?? `${window.location.origin}/api/chat`,
    primaryColor: el.dataset['color'] ?? '#2563eb',
    botName: el.dataset['botName'] ?? 'Assistente',
    // Falls back to the slug (companyId) for older install snippets that
    // don't set this yet — still routable, just less natural-reading.
    companyName: el.dataset['companyName'] || companyId,
    whatsappNumber: el.dataset['whatsapp'] || undefined,
    // Pipe-separated, e.g. data-quick-replies="Pergunta um?|Pergunta dois?"
    quickReplies: el.dataset['quickReplies']
      ?.split('|')
      .map((q) => q.trim())
      .filter(Boolean),
  };
}

// document.currentScript is only reliable synchronously during the initial
// parse of this script tag — read it now, before any deferred mount below.
const script = document.currentScript;
const config: WidgetConfig = script
  ? readConfig(script)
  : {
      companyId: 'unknown',
      apiUrl: `${window.location.origin}/api/chat`,
      primaryColor: '#2563eb',
      botName: 'Assistente',
      companyName: 'unknown',
    };

function mount(): void {
  new ChatWidget(config);
}

if (document.body) {
  mount();
} else {
  // `async` scripts in <head> can execute before <body> exists.
  document.addEventListener('DOMContentLoaded', mount);
}
