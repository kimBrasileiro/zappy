import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: 'acme-demo' },
    update: {},
    create: {
      name: 'Acme Demo',
      slug: 'acme-demo',
      plan: 'starter',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@acme-demo.test' },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@acme-demo.test',
      name: 'Admin Demo',
      role: 'admin',
    },
  });

  // Zappy's own account — dogfoods the exact same multi-tenant chat/booking
  // system for the institutional site (apps/web/app/marketing-home.tsx): the
  // "Demo" service below IS how a lead books a demo, and the FAQs below ARE
  // what the chat answers about the product itself. No bot code needed.
  const zappy = await prisma.company.upsert({
    where: { slug: 'zappy' },
    update: {},
    create: {
      name: 'Zappy',
      slug: 'zappy',
      plan: 'internal',
      config: { botName: 'Assistente Zappy' },
    },
  });

  const existingDemoService = await prisma.service.findFirst({ where: { companyId: zappy.id, name: 'Demo' } });
  if (!existingDemoService) {
    await prisma.service.create({
      data: {
        companyId: zappy.id,
        name: 'Demo',
        description: 'Demonstração guiada da plataforma Zappy com o time comercial.',
        durationMinutes: 30,
        priceCents: 0,
        bookingMode: 'manual', // a human runs the actual demo call
      },
    });
  }

  const existingFaqCount = await prisma.faq.count({ where: { companyId: zappy.id } });
  if (existingFaqCount === 0) {
    await prisma.faq.createMany({
      data: [
        {
          companyId: zappy.id,
          question: 'O que é a Zappy?',
          answer:
            'A Zappy é uma plataforma de atendimento via IA que conversa com seus clientes no seu site e no WhatsApp, tira dúvidas, responde o FAQ da sua empresa e agenda horários automaticamente — com um humano do seu time podendo assumir a conversa a qualquer momento.',
        },
        {
          companyId: zappy.id,
          question: 'Quanto custa?',
          answer:
            'O plano básico custa R$ 197/mês e já inclui o widget de chat pro seu site e um número de WhatsApp compartilhado da Zappy. Se você quiser um número de WhatsApp exclusivo da sua empresa, o plano custa R$ 397/mês; se quiser conectar com um sistema de agendamento que você já usa, custa R$ 997/mês. Cada plano já inclui tudo do básico.',
        },
        {
          companyId: zappy.id,
          question: 'Como funciona o agendamento?',
          answer:
            'Você cadastra seus serviços (nome, duração, preço) no dashboard, e o bot verifica os horários livres e confirma o agendamento direto com o cliente, respeitando o horário de funcionamento da sua empresa.',
        },
        {
          companyId: zappy.id,
          question: 'Como funciona o WhatsApp?',
          answer:
            'Toda empresa que assina a Zappy já sai com acesso a um número de WhatsApp compartilhado — o mesmo bot que atende no seu site também atende por lá, identificando automaticamente qual empresa o cliente quer falar.',
        },
        {
          companyId: zappy.id,
          question: 'E se o bot não souber responder?',
          answer:
            'O bot encaminha a conversa pra um atendente humano automaticamente, e ela aparece na aba Inbox do seu dashboard pra alguém do seu time responder.',
        },
        {
          companyId: zappy.id,
          question: 'Como instalo no meu site?',
          answer:
            'Depois de assinar, você cola uma única linha de <script> no seu site, sem mexer em mais nada, e o chat já aparece funcionando.',
        },
      ],
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
