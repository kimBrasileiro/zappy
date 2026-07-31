import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { updateFaq } from '../actions';
import { FaqForm } from '../faq-form';

export default async function EditFaqPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.faq');

  const faq = await prisma.faq.findUnique({ where: { id: params.id } });
  if (!faq || faq.companyId !== companyId) notFound();

  return (
    <>
      <h1 className="dash-h1">{t('editTitle')}</h1>
      <div className="dash-card">
        <FaqForm
          action={updateFaq.bind(null, faq.id)}
          defaultValues={{ question: faq.question, answer: faq.answer }}
          submitLabel={t('saveChanges')}
        />
      </div>
    </>
  );
}
