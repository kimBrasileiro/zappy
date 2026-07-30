'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isSupportedLocale, LOCALE_COOKIE } from '../i18n/locales';

// Shared between the marketing homepage and the dashboard nav (see
// locale-switcher.tsx) — a plain cookie write, not tied to any account:
// this is a stateful UI-language switch, not the per-company bot-reply
// language (Company.config.language, untouched by this).
export async function setLocale(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) return;

  const cookieStore = await cookies();
  // One year, same reasoning as any other durable preference cookie — this
  // is a UI choice, not a session, so it should outlive the session.
  cookieStore.set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: '/' });
  revalidatePath('/', 'layout');
}
