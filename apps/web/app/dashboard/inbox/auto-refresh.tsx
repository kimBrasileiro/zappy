'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 5000;

// Server Components don't push updates — without this, a new escalation or
// customer message only shows up here after a manual click on RefreshButton.
// Same 5s cadence the widget itself polls at (apps/widget/src/widget.ts's
// POLL_INTERVAL_MS), so a new message shows up in the Inbox about as fast as
// it would in the customer's own chat. Paused while the tab isn't visible —
// no point re-fetching a list nobody's looking at.
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
