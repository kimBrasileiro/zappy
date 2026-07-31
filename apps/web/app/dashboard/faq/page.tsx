import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { createFaq, deleteFaq, toggleFaqActive } from './actions';
import { FaqForm } from './faq-form';
import { RefreshButton } from '../refresh-button';

export default async function FaqPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.faq');

  const faqs = await prisma.faq.findMany({
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
        <FaqForm action={createFaq} submitLabel={t('createLabel')} />
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableQuestion')}</th>
            <th>{t('tableStatus')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {faqs.map((faq) => (
            <tr key={faq.id}>
              <td>
                <Link href={`/dashboard/faq/${faq.id}`}>{faq.question}</Link>
              </td>
              <td>
                <span className={faq.active ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {faq.active ? t('statusActive') : t('statusInactive')}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <form action={toggleFaqActive.bind(null, faq.id)}>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {faq.active ? t('deactivate') : t('activate')}
                  </button>
                </form>
                <form action={deleteFaq.bind(null, faq.id)}>
                  <button type="submit" className="dash-btn dash-btn-danger">
                    {t('delete')}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {faqs.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: '#999' }}>
                {t('noFaqs')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
