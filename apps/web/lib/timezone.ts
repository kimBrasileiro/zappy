// No real per-company timezone support exists yet (see services.ts) — this
// is a deliberately simple, honest stand-in: every company is assumed to
// run on America/Sao_Paulo (UTC-3). Brazil has observed no DST since 2019,
// so a fixed offset is correct today, not just a rough approximation.
export const BRAZIL_UTC_OFFSET_HOURS = 3;

// Constructs the real UTC instant for a given Brazil-local wall-clock
// Y/M/D/H/M — the inverse of toBrazilWallClock below. Use this anywhere a
// business-hours string ("09:00"), a customer-resolved date/time, or a
// day boundary needs to become a real Date.
export function brazilWallClockToUtc(
  year: number,
  month0: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(Date.UTC(year, month0, day, hour + BRAZIL_UTC_OFFSET_HOURS, minute, second, ms));
}

// Reads Brazil-local wall-clock parts out of a real UTC Date — the inverse
// of brazilWallClockToUtc. Use this anywhere a stored instant needs to be
// bucketed or reconstructed by its Brazil-local day/hour.
export function toBrazilWallClock(date: Date): {
  year: number;
  month0: number;
  day: number;
  hour: number;
  minute: number;
} {
  // Brazil is UTC-3 (behind UTC), so converting a UTC instant TO Brazil-local
  // wall-clock means going backward — subtract, not add (brazilWallClockToUtc
  // above correctly adds, since that direction, Brazil-local to UTC, moves
  // forward).
  const shifted = new Date(date.getTime() - BRAZIL_UTC_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month0: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

// Renders a UTC instant as a Brazil-local date/time string — for any
// customer- or admin-facing text (WhatsApp messages, emails). Plain
// `date.toLocaleString('pt-BR')` depends on the server's own timezone; Cloud
// Run's containers default to UTC, which silently rendered the raw UTC hour
// (3h off) in production. Always pass the explicit timeZone instead.
export function formatBrazilDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
