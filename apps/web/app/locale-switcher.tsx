'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { setLocale } from '../lib/set-locale';
import { SUPPORTED_LOCALES } from '../i18n/locales';

// Mounted in both dashboard/layout.tsx's nav and marketing-home.tsx's
// header — same component, same behavior (write the NEXT_LOCALE cookie,
// refresh so the server re-renders with it). No auto-detection anywhere:
// this explicit switch is the only thing that ever changes the locale.
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('localeSwitcher');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            await setLocale(l);
            router.refresh();
          })}
          style={{
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: 600,
            cursor: pending ? 'default' : 'pointer',
            background: l === locale ? '#2563eb' : '#fff',
            color: l === locale ? '#fff' : '#555',
          }}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
