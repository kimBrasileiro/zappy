// Split out from request.ts on purpose: that file's default export
// (getRequestConfig) imports next/headers, which is server-only — a client
// component (locale-switcher.tsx) importing anything from the same module,
// even a plain constant, pulls that whole module (and next/headers with
// it) into the client bundle, which Next.js rejects outright. Nothing here
// imports anything server-only, so both server and client code can import
// from this file safely.
export const LOCALE_COOKIE = 'NEXT_LOCALE';
// Compiled-in fallback only — the real effective default is resolved in
// request.ts from the DEFAULT_LOCALE env var (server-only, so it isn't
// read here where this file is also imported by client components). Lets
// a separately-deployed instance on its own domain (e.g. a Spain
// deployment) default to Spanish site-wide via one env var, zero code
// changes, same codebase.
export const FALLBACK_LOCALE = 'pt';
export const SUPPORTED_LOCALES = ['pt', 'es', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
