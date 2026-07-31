import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage } from '../legal-layout';

// Deliberately static/Portuguese, not locale-aware — crawlers never carry
// the NEXT_LOCALE cookie this switcher relies on (see app/layout.tsx's own
// metadata for the same reasoning), and this page is noindex anyway.
export const metadata: Metadata = {
  title: 'Política de Privacidade',
  robots: { index: false },
};

const h2 = { fontSize: 18, margin: '32px 0 10px' };

interface LegalSection {
  title: string;
  body: string;
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  const sections = t.raw('privacy.sections') as LegalSection[];

  return (
    <LegalPage title={t('privacyTitle')} lastUpdated="30 de julho de 2026">
      {sections.map((section) => (
        <div key={section.title}>
          <h2 style={h2}>{section.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: section.body }} />
        </div>
      ))}
    </LegalPage>
  );
}
