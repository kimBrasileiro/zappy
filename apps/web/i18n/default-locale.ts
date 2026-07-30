import { FALLBACK_LOCALE, isSupportedLocale, type Locale } from './locales';

// This deployment's own default locale (DEFAULT_LOCALE env var, e.g. "es"
// for a Spain deployment) — the single source of truth for both a first-
// time visitor's UI locale (i18n/request.ts) and what language a brand-new
// company starts in: its seeded default FAQs (default-faqs.ts) and its own
// bot's reply language for its own customers (Company.config.language, set
// at creation in signup/actions.ts and onboarding/actions.ts). Falls back
// to FALLBACK_LOCALE ('pt') if unset or not a supported code.
export function getDeploymentDefaultLocale(): Locale {
  return isSupportedLocale(process.env.DEFAULT_LOCALE) ? process.env.DEFAULT_LOCALE : FALLBACK_LOCALE;
}
