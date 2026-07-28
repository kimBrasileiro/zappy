import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../../lib/auth-server';
import { encrypt } from '../../../../../lib/crypto';
import { STATE_COOKIE } from '../authorize/route';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const REDIRECT_PATH = '/api/integrations/google-calendar/callback';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function GET(request: Request) {
  const { companyId } = await requireSession();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const integracoesUrl = new URL('/dashboard/integracoes', appUrl);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    integracoesUrl.searchParams.set('error', 'invalid_state');
    return NextResponse.redirect(integracoesUrl);
  }

  try {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${appUrl}${REDIRECT_PATH}`,
      }),
    });
    if (!tokenResponse.ok) throw new Error(`token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
    const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token?: string };

    // A missing refresh_token here means the account had already granted this
    // exact scope before without us ever getting one saved — access_type/
    // prompt=consent on the authorize side should prevent this, but if it
    // still happens, failing loudly beats silently saving a connection that
    // can never actually refresh.
    if (!tokens.refresh_token) throw new Error('no_refresh_token_returned');

    const userinfoResponse = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userinfoResponse.ok) throw new Error(`userinfo fetch failed: ${userinfoResponse.status}`);
    const userinfo = (await userinfoResponse.json()) as { email?: string };

    await prisma.company.update({
      where: { id: companyId },
      data: {
        googleCalendarId: 'primary',
        googleCalendarRefreshTokenEncrypted: encrypt(tokens.refresh_token),
        googleCalendarConnectedEmail: userinfo.email ?? null,
        googleCalendarConnectedAt: new Date(),
      },
    });

    integracoesUrl.searchParams.set('connected', '1');
    return NextResponse.redirect(integracoesUrl);
  } catch (err) {
    console.error('[google-calendar] connect failed', err);
    integracoesUrl.searchParams.set('error', 'connect_failed');
    return NextResponse.redirect(integracoesUrl);
  }
}
