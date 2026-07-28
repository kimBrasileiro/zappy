import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireSession } from '../../../../../lib/auth-server';

// A separate Google OAuth Client from login's (lib/auth.ts's
// socialProviders.google, GOOGLE_CLIENT_ID/SECRET) — GOOGLE_CALENDAR_CLIENT_ID/
// SECRET here. Deliberately not shared: login only ever needs
// openid/email/profile, this needs the sensitive `calendar` scope, and
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
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email',
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
