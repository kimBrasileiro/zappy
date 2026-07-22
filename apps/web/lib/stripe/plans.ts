// Matches marketing-home.tsx#PRICING — kept as separate hardcoded copy here
// the same way the rest of this codebase's pricing displays already are
// (no shared source of truth for pricing text yet).
export const PLANS = [
  { key: 'basico', label: 'Básico', price: 'R$ 197/mês' },
  { key: 'whatsapp_proprio', label: 'WhatsApp próprio', price: 'R$ 397/mês' },
  { key: 'integracao', label: 'Integração com seu sistema', price: 'R$ 997/mês' },
] as const;

// Only a proxy for "Stripe is configured" (real check is server-side, see
// lib/stripe/client.ts#isStripeConfigured) — but it's what decides whether
// the plan selector renders at all, so that without Stripe set up, signup
// and onboarding look and behave exactly like they did before this feature
// existed.
export const stripeConfiguredOnClient = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
