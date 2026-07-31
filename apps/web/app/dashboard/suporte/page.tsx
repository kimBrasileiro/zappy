import { getTranslations } from 'next-intl/server';
import { SupportForm } from './support-form';

export default async function SuportePage() {
  const t = await getTranslations('dashboard.support');
  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">
        {t('subtitle')}
      </p>

      <div className="dash-card">
        <SupportForm />
      </div>
    </>
  );
}
