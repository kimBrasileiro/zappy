import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const company = await prisma.company.findFirst({ where: { slug: 'kim-local' } });
if (!company) { console.log('no kim-local company found, skipping'); process.exit(0); }

const customer = await prisma.customer.upsert({
  where: { companyId_phone: { companyId: company.id, phone: '11999990000' } },
  update: {},
  create: { companyId: company.id, phone: '11999990000', name: 'Cliente Antigo Teste', channel: 'whatsapp' },
});

const ticket = await prisma.ticket.create({
  data: {
    companyId: company.id,
    customerId: customer.id,
    channel: 'whatsapp',
    status: 'waiting_human',
    priority: 'normal',
  },
});

await prisma.message.create({
  data: {
    ticketId: ticket.id,
    companyId: company.id,
    senderType: 'customer',
    content: 'Oi, ainda tem horário pra amanhã?',
    contentType: 'text',
    createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
  },
});

console.log('ticketId:', ticket.id);
