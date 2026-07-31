import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { updateTemplate } from '../actions';
import { TemplateForm } from '../template-form';

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.quickReplies');

  const template = await prisma.responseTemplate.findUnique({ where: { id: params.id } });
  if (!template || template.companyId !== companyId) notFound();

  return (
    <>
      <h1 className="dash-h1">{t('editTitle')}</h1>
      <div className="dash-card">
        <TemplateForm
          action={updateTemplate.bind(null, template.id)}
          defaultValues={{
            name: template.name,
            content: template.content,
            shortcut: template.shortcut,
            category: template.category,
          }}
          submitLabel={t('saveChanges')}
        />
      </div>
    </>
  );
}
