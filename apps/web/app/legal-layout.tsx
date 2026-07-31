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

      {/* Not legal advice — a placeholder-filled starting point, not a
          substitute for review by an actual lawyer before this touches real
          payments. Deliberately loud so it doesn't get missed and
          accidentally shipped as-is. */}
      <div
        style={{
          background: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: 10,
          padding: '14px 18px',
          fontSize: 13.5,
          color: '#92400e',
          marginBottom: 32,
        }}
      >
        {t('disclaimer')}
      </div>

      <div style={{ fontSize: 14.5, color: '#333' }}>{children}</div>
    </main>
  );
}
