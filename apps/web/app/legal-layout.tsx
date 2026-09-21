import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

const BRAND_COLOR = '#2563eb';

export async function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  const t = await getTranslations('legal');

  return (
    <main
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        color: '#1a1a1a',
        maxWidth: 760,
        margin: '0 auto',
        padding: '48px 24px 100px',
        lineHeight: 1.7,
      }}
    >
      <Link href="/" style={{ color: BRAND_COLOR, fontSize: 13.5, textDecoration: 'none' }}>
        {t('backLink')}
      </Link>

      <h1 style={{ fontSize: 30, margin: '20px 0 4px' }}>{title}</h1>
      <p style={{ color: '#888', fontSize: 13, margin: '0 0 28px' }}>{t('lastUpdatedPrefix')} {lastUpdated}</p>

      <div style={{ fontSize: 14.5, color: '#333' }}>{children}</div>
    </main>
  );
}
