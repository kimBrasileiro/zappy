import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE } from './locales';

// Cookie-driven locale, deliberately NOT next-intl's [locale] route-segment
// + middleware setup: this is a stateful switcher for existing dashboard
// users/site visitors (see set-locale.ts), not separate crawlable per-
// language URLs — that job belongs to a genuinely separate deployment
// (own domain, own region), not to this same app serving three languages
// off the same routes. No auto-detection either (no Accept-Language
// sniffing) — defaults to Portuguese until someone explicitly switches.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
