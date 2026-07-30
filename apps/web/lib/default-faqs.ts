import { prisma } from '@zappigo/db';
import { getDeploymentDefaultLocale } from '../i18n/default-locale';
import type { Locale } from '../i18n/locales';

// Seeded once at company creation (signup/actions.ts, onboarding/actions.ts)
// so a brand-new company's FAQ isn't empty before they've had a chance to
// add their own — these are about the assistant/booking flow itself (true
// for every company, unlike hours/payment/address, which only the company
// itself knows), so the company can edit or delete them freely without
// breaking anything. Language follows this deployment's own default
// (DEFAULT_LOCALE — see i18n/default-locale.ts) — a company signing up on
// a Spanish-default deployment gets Spanish seed FAQs, matching the
// Company.config.language signup/onboarding actions.ts sets at the same
// time, so the bot's own replies and its starting FAQ content agree from
// the first message.
const DEFAULT_FAQS: Record<Locale, { question: string; answer: string }[]> = {
  pt: [
    {
      question: 'Como funciona esse assistente?',
      answer:
        'Sou um assistente virtual que responde dúvidas, mostra os serviços disponíveis e agenda horários automaticamente. Se eu não souber responder algo, encaminho para alguém da equipe.',
    },
    {
      question: 'Como faço para agendar um horário?',
      answer:
        'É rapidinho! Me diga qual serviço você quer e uma data — eu verifico os horários disponíveis e confirmo o agendamento com você.',
    },
    {
      question: 'Posso falar com uma pessoa de verdade?',
      answer: 'Claro! É só pedir para falar com um atendente que encaminho a conversa para a nossa equipe.',
    },
    {
      question: 'Posso cancelar ou remarcar meu agendamento?',
      answer: 'Sim! Me avise que você quer cancelar ou remarcar, e encaminho pra equipe confirmar a alteração.',
    },
  ],
  es: [
    {
      question: '¿Cómo funciona este asistente?',
      answer:
        'Soy un asistente virtual que responde dudas, muestra los servicios disponibles y agenda citas automáticamente. Si no sé responder algo, lo derivo a alguien del equipo.',
    },
    {
      question: '¿Cómo agendo una cita?',
      answer:
        '¡Es rapidísimo! Dime qué servicio quieres y una fecha — verifico los horarios disponibles y confirmo la cita contigo.',
    },
    {
      question: '¿Puedo hablar con una persona de verdad?',
      answer: '¡Claro! Solo pide hablar con un agente y derivo la conversación a nuestro equipo.',
    },
    {
      question: '¿Puedo cancelar o cambiar mi cita?',
      answer: '¡Sí! Avísame que quieres cancelar o reprogramar, y le aviso al equipo para confirmar el cambio.',
    },
  ],
  en: [
    {
      question: 'How does this assistant work?',
      answer:
        "I'm a virtual assistant that answers questions, shows available services, and books appointments automatically. If I don't know something, I'll forward it to someone on the team.",
    },
    {
      question: 'How do I book an appointment?',
      answer: "It's quick! Tell me which service you want and a date — I'll check open time slots and confirm the appointment with you.",
    },
    {
      question: 'Can I talk to a real person?',
      answer: 'Of course! Just ask to talk to an agent and I\'ll forward the conversation to our team.',
    },
    {
      question: 'Can I cancel or reschedule my appointment?',
      answer: "Yes! Just let me know you'd like to cancel or reschedule, and I'll have the team confirm the change.",
    },
  ],
};

export async function createDefaultFaqs(companyId: string): Promise<void> {
  const locale = getDeploymentDefaultLocale();
  await prisma.faq.createMany({
    data: DEFAULT_FAQS[locale].map((faq) => ({ companyId, question: faq.question, answer: faq.answer })),
  });
}
