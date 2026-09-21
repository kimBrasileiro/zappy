'use client';

import { useEffect } from 'react';

// Posts this document's real height to whatever page framed it, so the
// <iframe> snippet on a customer's own site (see dashboard/instalacao's
// generated script) can resize itself instead of showing a fixed height
// that clips the form once time slots expand it, or leaving dead
// whitespace when they don't. targetOrigin is '*' deliberately — the host
// page's origin is unknown ahead of time (any customer's own site), and a
// height number carries nothing worth restricting the recipient over.
export function ResizeReporter() {
  useEffect(() => {
    function postHeight() {
      window.parent?.postMessage({ type: 'zappigo-booking-embed-height', height: document.body.scrollHeight }, '*');
    }
    postHeight();
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return null;
}
