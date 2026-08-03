const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_CUTOFF_MS = 7 * DAY_MS;

// "2m", "3h", "5d" style relative time for recent activity, falling back to
// an absolute short date once it's old enough that "N days ago" stops being
// useful. Locale comes from the caller (next-intl's getLocale()) — Intl
// handles the actual per-language wording, no manual translation keys.
export function formatRelativeTime(date: Date, locale: string): string {
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs >= RELATIVE_CUTOFF_MS) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' });
  if (absMs < MINUTE_MS) return rtf.format(0, 'minute');
  if (absMs < HOUR_MS) return rtf.format(Math.round(diffMs / MINUTE_MS), 'minute');
  if (absMs < DAY_MS) return rtf.format(Math.round(diffMs / HOUR_MS), 'hour');
  return rtf.format(Math.round(diffMs / DAY_MS), 'day');
}

export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
