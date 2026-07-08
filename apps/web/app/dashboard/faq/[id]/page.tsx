import { notFound } from 'next/navigation';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../../lib/auth-server';
import { updateFaq } from '../actions';
import { FaqForm } from '../faq-form';

export default async function EditFaqPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();

  const faq = await prisma.faq.findUnique({ where: { id: params.id } });
  if (!faq || faq.companyId !== companyId) notFound();

  return (
    <>
      <h1 className="dash-h1">Editar FAQ</h1>
      <div className="dash-card">
        <FaqForm
          action={updateFaq.bind(null, faq.id)}
          defaultValues={{ question: faq.question, answer: faq.answer }}
          submitLabel="Salvar alterações"
        />
      </div>
    </>
  );
}
