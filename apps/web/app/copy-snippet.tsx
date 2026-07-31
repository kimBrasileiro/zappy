'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function CopySnippet({ snippet }: { snippet: string }) {
  const t = useTranslations('dashboard.common');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ position: 'relative' }}>
      <pre
        style={{
          background: '#0f1115',
          color: '#d9dde3',
          padding: '14px 16px',
          borderRadius: 10,
          fontSize: 12.5,
          overflowX: 'auto',
          margin: 0,
        }}
      >
        <code>{snippet}</code>
      </pre>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: copied ? '#16a34a' : '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {copied ? t('copied') : t('copy')}
      </button>
    </div>
  );
}
