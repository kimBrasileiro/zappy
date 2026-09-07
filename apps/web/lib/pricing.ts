// Deployment-level pricing — deliberately NOT part of the translated
// message files (messages/*.json): switching the UI language must never
// change what a customer is actually charged, but a genuinely separate
// deployment with its own Stripe account and currency (e.g. a EUR-billing
// Spain deployment) needs its own numbers. Unset env vars reproduce this
// codebase's original BRL pricing exactly.
//
// NEXT_PUBLIC_-prefixed (not just server-side env vars) on purpose: this
// module is imported from CLIENT components too (signup/page.tsx,
// onboarding-form.tsx render the plan's price in the browser) — a plain
// `process.env.PRICING_AMOUNT_BASICO` read is statically replaced by
// webpack only for NEXT_PUBLIC_* names when bundling for the client; any
// other env var silently reads as `undefined` in the browser regardless of
// what the server's real runtime value is, which is exactly what happened
// here (client-rendered signup showed the hardcoded '197' fallback even
// once the real deployment env var was correctly set to '19' — the
// fallback was the ONLY thing the client bundle could ever see). Pricing is
// already public information (shown on the marketing page to anyone), so
// there's no confidentiality reason to keep it server-only.
const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_PRICING_CURRENCY_SYMBOL ?? 'R$';
export const PRICING_CURRENCY_CODE = process.env.NEXT_PUBLIC_PRICING_CURRENCY_CODE ?? 'BRL';

function price(envVar: string, fallbackAmount: string): string {
  return `${CURRENCY_SYMBOL} ${process.env[envVar] ?? fallbackAmount}`;
}

export const PRICE_FREE = price('NEXT_PUBLIC_PRICING_AMOUNT_FREE', '0');
export const PRICE_BASICO = price('NEXT_PUBLIC_PRICING_AMOUNT_BASICO', '19');
