import { prisma } from '@zappy/db';

export async function listFaqs(companyId: string) {
  const faqs = await prisma.faq.findMany({
    where: { companyId, active: true },
    orderBy: { createdAt: 'asc' },
  });
  return faqs.map((f) => ({ question: f.question, answer: f.answer }));
}
