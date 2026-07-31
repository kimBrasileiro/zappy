'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ICON_REFRESH = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Server Components don't auto-refresh — this is the one button dropped into
// every list page and the ticket detail page (per request) to re-run the
// page's own data fetch via router.refresh(), rather than each page growing
// its own bespoke reload logic.
export function RefreshButton() {
  const t = useTranslations('dashboard.common');
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    setSpinning(true);
    router.refresh();
    // router.refresh() has no completion callback — this is just enough of a
    // spin to confirm the click registered, not a real progress indicator.
    setTimeout(() => setSpinning(false), 500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="dash-btn dash-btn-secondary dash-refresh-btn"
      aria-label={t('refresh')}
      title={t('refresh')}
    >
      <span
        className={spinning ? 'dash-refresh-spin' : ''}
        style={{ display: 'inline-flex', width: 14, height: 14 }}
        dangerouslySetInnerHTML={{ __html: ICON_REFRESH }}
      />
      {t('refresh')}
    </button>
  );
}
