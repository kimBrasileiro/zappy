import { prisma } from '@zappy/db';

// Seeded once at company creation (signup/actions.ts, onboarding/actions.ts)
// so a brand-new company's FAQ isn't empty before they've had a chance to
// add their own — these are about the assistant/booking flow itself
// (true for every company, unlike hours/payment/address, which only the
// company itself knows), so the company can edit or delete them freely
// without breaking anything.
export async function createDefaultFaqs(companyId: string): Promise<void> {
  await prisma.faq.createMany({
    data: [
      {
        companyId,
        question: 'Como funciona esse assistente?',
        answer:
          'Sou um assistente virtual que responde dúvidas, mostra os serviços disponíveis e agenda horários automaticamente. Se eu não souber responder algo, encaminho para alguém da equipe.',
      },
      {
        companyId,
        question: 'Como faço para agendar um horário?',
        answer:
          'É rapidinho! Me diga qual serviço você quer e uma data — eu verifico os horários disponíveis e confirmo o agendamento com você.',
      },
      {
        companyId,
        question: 'Posso falar com uma pessoa de verdade?',
        answer: 'Claro! É só pedir para falar com um atendente que encaminho a conversa para a nossa equipe.',
      },
      {
        companyId,
        question: 'Posso cancelar ou remarcar meu agendamento?',
        answer: 'Sim! Me avise que você quer cancelar ou remarcar, e encaminho pra equipe confirmar a alteração.',
      },
    ],
  });
}
