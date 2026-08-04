// Centralized date/time module — every UTC<->local conversion and every
// user-facing date/time string in this app routes through here. Nothing
// else should hardcode a timezone or call toLocaleString without one.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_CUTOFF_MS = 7 * DAY_MS;

// This deployment's own IANA timezone (DEFAULT_TIMEZONE env var, e.g.
// "Europe/Madrid" for the Spain deployment) — same pattern as
// i18n/default-locale.ts#getDeploymentDefaultLocale(). Falls back to
// "America/Sao_Paulo" so this codebase's original behavior is reproduced
// exactly on every environment that doesn't set it (BR staging/production).
export function getDeploymentTimezone(): string {
  return process.env.DEFAULT_TIMEZONE || 'America/Sao_Paulo';
}

// The real UTC offset (in minutes, positive = ahead of UTC) `timeZone` is
// at the instant `date` — derived from Intl.DateTimeFormat's own knowledge
// of the platform timezone database, so DST transitions are handled
// correctly for any IANA zone (not just a fixed-offset one like BRT).
// Technique: format `date` in `timeZone` to get wall-clock parts, then
// treat those same parts as if they were UTC — the difference between that
// and the real instant is exactly the offset.
function offsetMinutesAt(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (wallClockAsUtc - date.getTime()) / MINUTE_MS;
}

// Wall-clock Y/M/D/H/M/S in `timeZone` -> the real UTC Date. Two-pass fixed
// point: the offset needed to convert depends on which UTC instant you
// land on, which matters right at a DST transition — a first guess
// (treating the wall-clock as UTC) gets the offset close enough that a
// second lookup at that adjusted instant converges on the correct one.
// (The one inherent ambiguity — a wall-clock time that occurs twice, in
// the "fall back" hour — has no single correct answer in any timezone
// library; this picks one consistently, same as everywhere else.)
export function wallClockToUtc(
  timeZone: string,
  year: number,
  month0: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const guess = Date.UTC(year, month0, day, hour, minute, second, ms);
  const offset1 = offsetMinutesAt(new Date(guess), timeZone);
  const offset2 = offsetMinutesAt(new Date(guess - offset1 * MINUTE_MS), timeZone);
  return new Date(guess - offset2 * MINUTE_MS);
}

// Inverse: a real UTC Date -> its wall-clock parts in `timeZone`.
export function toWallClock(
  timeZone: string,
  date: Date,
): { year: number; month0: number; day: number; hour: number; minute: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month0: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

// "2m", "3h", "5d" style relative time for recent activity, falling back to
// an absolute short date once it's old enough that "N days ago" stops being
// useful. Locale comes from the caller (next-intl's getLocale()) — Intl
// handles the actual per-language wording, no manual translation keys.
// timeZone defaults to this deployment's own — existing callers that don't
// pass one (Inbox, Conversation detail, Leads) get the fix for free.
export function formatRelativeTime(date: Date, locale: string, timeZone: string = getDeploymentTimezone()): string {
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs >= RELATIVE_CUTOFF_MS) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short', timeZone }).format(date);
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' });
  if (absMs < MINUTE_MS) return rtf.format(0, 'minute');
  if (absMs < HOUR_MS) return rtf.format(Math.round(diffMs / MINUTE_MS), 'minute');
  if (absMs < DAY_MS) return rtf.format(Math.round(diffMs / HOUR_MS), 'hour');
  return rtf.format(Math.round(diffMs / DAY_MS), 'day');
}

export function formatDateTime(date: Date, locale: string, timeZone: string = getDeploymentTimezone()): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}

// Date-only formatting (e.g. "3 de ago. de 2026"), no time-of-day — for
// display call sites that only ever show a calendar date.
export function formatDate(date: Date, locale: string, timeZone: string = getDeploymentTimezone()): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(date);
}
