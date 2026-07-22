export function buildStyles(primaryColor: string): string {
  return /* css */ `
    :host {
      all: initial;
      position: fixed;
      inset: auto 20px 20px auto;
      z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .root {
      --primary: ${primaryColor};
      --bg: #ffffff;
      --fg: #1a1a1a;
      --bot-bubble-bg: #f1f2f4;
      --border: rgba(0, 0, 0, 0.08);
      --shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }

    @media (prefers-color-scheme: dark) {
      .root {
        --bg: #1e1f24;
        --fg: #f2f2f3;
        --bot-bubble-bg: #2b2d34;
        --border: rgba(255, 255, 255, 0.08);
        --shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
      }
    }

    .fab {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: var(--primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: var(--shadow);
      transition: transform 0.15s ease;
      flex-shrink: 0;
    }
    .fab:hover {
      transform: scale(1.06);
    }
    .fab svg {
      width: 26px;
      height: 26px;
    }

    .panel {
      width: 360px;
      height: 520px;
      max-height: 75vh;
      background: var(--bg);
      color: var(--fg);
      border-radius: 16px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform-origin: bottom right;
      animation: cia-in 0.18s ease-out;
    }
    .panel.hidden {
      display: none;
    }

    @keyframes cia-in {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (max-width: 480px) {
      /* .panel gets its own position:fixed here rather than resizing :host —
         position:fixed establishes its containing block from the viewport
         regardless of the (small, bottom-right-anchored) host box, so the
         panel reliably covers the full screen instead of being clipped to
         the host's own box. */
      .panel:not(.hidden) {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
      .fab.panel-open { display: none; }
    }

    .header {
      background: var(--primary);
      color: #fff;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .header .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 600;
    }
    .header .name {
      font-weight: 600;
      font-size: 14px;
      flex: 1;
    }
    .header .close,
    .header .restart,
    .header .whatsapp {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      opacity: 0.85;
      padding: 4px;
      display: flex;
    }
    .header .close:hover,
    .header .restart:hover,
    .header .whatsapp:hover {
      opacity: 1;
    }
    .header .close svg,
    .header .restart svg,
    .header .whatsapp svg {
      width: 18px;
      height: 18px;
    }
    .header .whatsapp {
      color: #25d366;
    }

    .escalated-banner {
      display: none;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      background: #fef3c7;
      color: #92400e;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .escalated-banner.visible {
      display: flex;
    }
    .escalated-banner .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #d97706;
      flex-shrink: 0;
      animation: cia-bounce 1.6s infinite ease-in-out;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .bubble {
      max-width: 80%;
      padding: 9px 13px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .bubble.bot {
      align-self: flex-start;
      background: var(--bot-bubble-bg);
      color: var(--fg);
      border-bottom-left-radius: 4px;
    }
    .bubble.customer {
      align-self: flex-end;
      background: var(--primary);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .bubble.agent {
      align-self: flex-start;
      background: var(--bot-bubble-bg);
      color: var(--fg);
      border-bottom-left-radius: 4px;
      border-left: 3px solid var(--primary);
    }
    .msg-sender {
      align-self: flex-start;
      font-size: 11px;
      font-weight: 600;
      color: var(--primary);
      opacity: 0.85;
    }

    .typing {
      align-self: flex-start;
      display: flex;
      gap: 4px;
      padding: 11px 14px;
      background: var(--bot-bubble-bg);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
    }
    .typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.5;
      animation: cia-bounce 1.2s infinite ease-in-out;
    }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes cia-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 0.9; }
    }

    .quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 12px;
    }
    .chip {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--primary);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12.5px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .chip:hover {
      background: var(--bot-bubble-bg);
    }

    .msg-options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: -4px;
    }

    .input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .input {
      flex: 1;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 9px 14px;
      font-size: 13.5px;
      background: var(--bg);
      color: var(--fg);
      outline: none;
    }
    .input:focus {
      border-color: var(--primary);
    }
    .send {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      background: var(--primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: opacity 0.15s ease;
    }
    .send:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .send svg {
      width: 15px;
      height: 15px;
    }

    .footer {
      text-align: center;
      font-size: 10.5px;
      color: var(--fg);
      opacity: 0.4;
      padding: 4px 0 8px;
    }
  `;
}
