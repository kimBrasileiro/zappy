import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireSession } from '../../../../../lib/auth-server';

// A separate Google OAuth Client from login's (lib/auth.ts's
// socialProviders.google, GOOGLE_CLIENT_ID/SECRET) — GOOGLE_CALENDAR_CLIENT_ID/
// SECRET here. Deliberately not shared: login only ever needs
// openid/email/profile, this needs calendar-specific scopes (see below), and
// keeping them as two Cloud Console OAuth Clients means a compromised
// Calendar credential can't touch the login flow or vice versa.
const REDIRECT_PATH = '/api/integrations/google-calendar/callback';
export const STATE_COOKIE = 'zappigo_gcal_oauth_state';

export async function GET() {
  await requireSession(); // redirects to /login if not authenticated

  const state = randomBytes(24).toString('hex');
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — plenty for the redirect round-trip, short-lived on purpose
    path: '/',
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID as string,
    redirect_uri: `${appUrl}${REDIRECT_PATH}`,
    response_type: 'code',
    // Narrowest set that covers everything lib/google-calendar/client.ts
    // actually does: calendar.events (createEvent/deleteEvent) +
    // calendar.freebusy (getFreeBusy — freebusy.query accepts this narrower
    // scope, confirmed against Google's own API reference, no need for the
    // broad calendar.readonly/calendar scope). Matters beyond least-privilege
    // principle: narrower scopes are far more likely to land in Google's
    // "sensitive" verification tier instead of "restricted", which is the
    // difference between a quick review and a paid third-party security
    // assessment (CASA) that can take weeks.
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    // offline + consent together are what actually guarantee a refresh_token
    // comes back — without prompt=consent, a user who already granted this
    // scope once (from an earlier disconnect/reconnect) gets silently
    // re-approved with no refresh_token in the response at all.
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
