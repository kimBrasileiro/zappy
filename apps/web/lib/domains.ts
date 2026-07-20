// Shared by the dashboard save action (Company.allowedDomains) and the
// Origin-header check in guardrails.ts#checkOrigin — both sides need to
// agree on the same normalized shape, or a domain typed with "https://" or
// "www." in the dashboard would silently never match a real Origin header.
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}
