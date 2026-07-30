// Chrome strings for the widget's own UI — separate from the bot's reply
// language (WidgetConfig.language, threaded through to the backend, see
// api.ts#streamBotReply). Opt-in exactly like that: no `language` set
// (every existing install) renders byte-identical Portuguese to before —
// only the Zappigo marketing site's own widget sets it today.
export interface WidgetStrings {
  continueOnWhatsApp: string;
  restartConversation: string;
  closeChat: string;
  openChat: string;
  waitingForHuman: string;
  messagePlaceholder: string;
  messageAriaLabel: string;
  send: string;
  poweredBy: string;
  agent: string;
  fallbackReply: string;
  whatsappGreeting: (companyName: string) => string;
  defaultQuickReplies: string[];
}

const STRINGS: Record<string, WidgetStrings> = {
  pt: {
    continueOnWhatsApp: 'Continuar no WhatsApp',
    restartConversation: 'Reiniciar conversa',
    closeChat: 'Fechar chat',
    openChat: 'Abrir chat',
    waitingForHuman: 'Aguardando um atendente humano',
    messagePlaceholder: 'Digite sua mensagem...',
    messageAriaLabel: 'Mensagem',
    send: 'Enviar',
    poweredBy: 'Powered by Zappigo',
    agent: 'Atendente',
    fallbackReply: 'Desculpa, tive um problema para responder agora. Tenta de novo em instantes.',
    whatsappGreeting: (name) => `Olá, gostaria de agendar serviços com ${name}`,
    defaultQuickReplies: ['Quais serviços vocês oferecem?', 'Quero agendar um horário', 'Quero falar com um atendente', 'Tenho dúvidas'],
  },
  es: {
    continueOnWhatsApp: 'Continuar en WhatsApp',
    restartConversation: 'Reiniciar conversación',
    closeChat: 'Cerrar chat',
    openChat: 'Abrir chat',
    waitingForHuman: 'Esperando un agente humano',
    messagePlaceholder: 'Escribe tu mensaje...',
    messageAriaLabel: 'Mensaje',
    send: 'Enviar',
    poweredBy: 'Powered by Zappigo',
    agent: 'Agente',
    fallbackReply: 'Lo siento, tuve un problema para responder ahora. Intenta de nuevo en un momento.',
    whatsappGreeting: (name) => `Hola, quiero agendar servicios con ${name}`,
    defaultQuickReplies: ['¿Qué servicios ofrecen?', 'Quiero agendar una cita', 'Quiero hablar con un agente', 'Tengo dudas'],
  },
  en: {
    continueOnWhatsApp: 'Continue on WhatsApp',
    restartConversation: 'Restart conversation',
    closeChat: 'Close chat',
    openChat: 'Open chat',
    waitingForHuman: 'Waiting for a human agent',
    messagePlaceholder: 'Type your message...',
    messageAriaLabel: 'Message',
    send: 'Send',
    poweredBy: 'Powered by Zappigo',
    agent: 'Agent',
    fallbackReply: 'Sorry, I had trouble replying right now. Try again in a moment.',
    whatsappGreeting: (name) => `Hi, I'd like to book services with ${name}`,
    defaultQuickReplies: ['What services do you offer?', 'I want to book an appointment', 'I want to talk to an agent', 'I have questions'],
  },
};

export function widgetStrings(language: string | undefined): WidgetStrings {
  return STRINGS[language ?? 'pt'] ?? STRINGS.pt!;
}
