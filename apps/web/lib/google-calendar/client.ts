import type { Company } from '@zappigo/db';
import { decrypt } from '../crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export type CalendarConnectedCompany = Pick<
  Company,
  'googleCalendarId' | 'googleCalendarRefreshTokenEncrypted'
>;

export function isCalendarConnected(company: CalendarConnectedCompany): boolean {
  return !!company.googleCalendarId && !!company.googleCalendarRefreshTokenEncrypted;
}

// No caching across requests on purpose — this bot's call volume per company
// is low enough (a handful of check_availability/create_booking calls per
// customer conversation) that trading a bit of latency for "always correct,
// nothing to invalidate" is the simpler tradeoff. Refresh tokens don't expire
// on their own; only revocation (user disconnects, or Google invalidates it)
// ever breaks this, which the caller has to handle as a real error either way.
async function getAccessToken(company: CalendarConnectedCompany): Promise<string> {
  if (!company.googleCalendarRefreshTokenEncrypted) {
    throw new Error('google_calendar_not_connected');
  }
  const refreshToken = decrypt(company.googleCalendarRefreshTokenEncrypted);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET as string,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`google_calendar_token_refresh_failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export interface BusyInterval {
  start: string; // ISO 8601
  end: string;
}

// Busy intervals for the connected calendar within [timeMinIso, timeMaxIso) —
// merged into checkAvailability's own slot computation (services.ts) as an
// extra blocking source, alongside existing bookings and staff absences.
export async function getFreeBusy(
  company: CalendarConnectedCompany,
  timeMinIso: string,
  timeMaxIso: string,
): Promise<BusyInterval[]> {
  const accessToken = await getAccessToken(company);
  const response = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      items: [{ id: company.googleCalendarId }],
    }),
  });
  if (!response.ok) {
    throw new Error(`google_calendar_freebusy_failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as {
    calendars?: Record<string, { busy?: BusyInterval[] }>;
  };
  return data.calendars?.[company.googleCalendarId as string]?.busy ?? [];
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
}

// Returns the created event's id — the caller (services.ts#createBooking)
// persists it on Booking.googleCalendarEventId so a later cancellation knows
// exactly which event to remove.
export async function createEvent(company: CalendarConnectedCompany, input: CreateEventInput): Promise<string> {
  const accessToken = await getAccessToken(company);
  const response = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(company.googleCalendarId as string)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startIso },
      end: { dateTime: input.endIso },
    }),
  });
  if (!response.ok) {
    throw new Error(`google_calendar_create_event_failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

// A failed delete leaves the event live on the customer's real calendar,
// permanently blocking that slot's availability until someone notices — see
// checkAvailability's self-heal filter in services.ts for the other half of
// this defense. Most real-world failures here are a transient network/API
// blip, not a lasting one, so a couple of retries clears the large majority
// of cases before ever reaching that fallback.
const DELETE_EVENT_ATTEMPTS = 3;

export async function deleteEvent(company: CalendarConnectedCompany, eventId: string): Promise<void> {
  const accessToken = await getAccessToken(company);
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(company.googleCalendarId as string)}/events/${encodeURIComponent(eventId)}`;

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= DELETE_EVENT_ATTEMPTS; attempt++) {
    const response = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    // 410 Gone means it's already deleted (e.g. removed by hand in Calendar) —
    // that's the outcome we wanted anyway, not a real failure.
    if (response.ok || response.status === 404 || response.status === 410) return;

    lastError = `${response.status} ${await response.text()}`;
    if (attempt < DELETE_EVENT_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw new Error(`google_calendar_delete_event_failed: ${lastError}`);
}
