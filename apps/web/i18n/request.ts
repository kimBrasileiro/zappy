import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { FALLBACK_LOCALE, isSupportedLocale, LOCALE_COOKIE } from './locales';

// Cookie-driven locale, deliberately NOT next-intl's [locale] route-segment
// + middleware setup: this is a stateful switcher for existing dashboard
// users/site visitors (see set-locale.ts), not separate crawlable per-
// language URLs — that job belongs to a genuinely separate deployment
// (own domain, own region), not to this same app serving three languages
// off the same routes. No auto-detection either (no Accept-Language
// sniffing) — the only two things that ever pick a locale are this
// deployment's own default (below) and an explicit switch.
//
// DEFAULT_LOCALE (server-only env var, e.g. "es") lets a separately
// deployed instance on its own domain default to a different language
// site-wide with no code change — falls back to FALLBACK_LOCALE ('pt',
// this codebase's own original default) if unset or not a supported code.
const DEFAULT_LOCALE = isSupportedLocale(process.env.DEFAULT_LOCALE) ? process.env.DEFAULT_LOCALE : FALLBACK_LOCALE;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
