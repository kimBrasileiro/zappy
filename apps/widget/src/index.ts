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
    language: el.dataset['lang'] || undefined,
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

// A property on `window`, not a module-scoped variable — a plain <script
// src> re-executing (see marketing-home.tsx's `key={locale}` on the
// Script tag, which forces exactly that on a locale switch) runs in a
// fresh top-level scope each time, so a module-scoped variable wouldn't
// carry over from the previous execution the way `window` does. Lets the
// new execution find and tear down the previous instance instead of
// stacking a second widget on the page.
declare global {
  interface Window {
    __zappigoWidgetInstance?: ChatWidget;
  }
}

function mount(): void {
  window.__zappigoWidgetInstance?.destroy();
  window.__zappigoWidgetInstance = new ChatWidget(config);
}

if (document.body) {
  mount();
} else {
  // `async` scripts in <head> can execute before <body> exists.
  document.addEventListener('DOMContentLoaded', mount);
}
