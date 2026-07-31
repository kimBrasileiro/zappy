// Deployment-level pricing — deliberately NOT part of the translated
// message files (messages/*.json): switching the UI language must never
// change what a customer is actually charged, but a genuinely separate
// deployment with its own Stripe account and currency (e.g. a EUR-billing
// Spain deployment) needs its own numbers. Unset env vars reproduce this
// codebase's original BRL pricing exactly.
const CURRENCY_SYMBOL = process.env.PRICING_CURRENCY_SYMBOL ?? 'R$';
export const PRICING_CURRENCY_CODE = process.env.PRICING_CURRENCY_CODE ?? 'BRL';

function price(envVar: string, fallbackAmount: string): string {
  return `${CURRENCY_SYMBOL} ${process.env[envVar] ?? fallbackAmount}`;
}

export const PRICE_FREE = price('PRICING_AMOUNT_FREE', '0');
export const PRICE_BASICO = price('PRICING_AMOUNT_BASICO', '197');
export const PRICE_WHATSAPP_PROPRIO = price('PRICING_AMOUNT_WHATSAPP_PROPRIO', '397');
export const PRICE_INTEGRACAO = price('PRICING_AMOUNT_INTEGRACAO', '997');
