import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { createTemplate, deleteTemplate, toggleTemplateActive } from './actions';
import { TemplateForm } from './template-form';
import { RefreshButton } from '../refresh-button';

export default async function QuickRepliesPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.quickReplies');

  const templates = await prisma.responseTemplate.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-card">
        <TemplateForm action={createTemplate} submitLabel={t('createLabel')} />
      </div>

      <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableName')}</th>
            <th>{t('tableShortcut')}</th>
            <th>{t('tableCategory')}</th>
            <th>{t('tableStatus')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id}>
              <td>
                <Link href={`/dashboard/quick-replies/${template.id}`}>{template.name}</Link>
              </td>
              <td>{template.shortcut ?? '—'}</td>
              <td>{template.category ?? '—'}</td>
              <td>
                <span className={template.active ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {template.active ? t('statusActive') : t('statusInactive')}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <form action={toggleTemplateActive.bind(null, template.id)}>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {template.active ? t('deactivate') : t('activate')}
                  </button>
                </form>
                <form action={deleteTemplate.bind(null, template.id)}>
                  <button type="submit" className="dash-btn dash-btn-danger">
                    {t('delete')}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {templates.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: '#999' }}>
                {t('noTemplates')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
