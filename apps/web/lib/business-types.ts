// Fixed set of self-reported business categories, captured at signup/
// onboarding purely for GTM segmentation (admin/companies, future
// reporting) — never read by the bot/booking logic itself. Keys are stored
// verbatim in Company.businessType; labels are translated (see the
// auth.businessTypes.* keys in messages/*.json).
export const BUSINESS_TYPES = ['salao_beleza', 'barbearia', 'pet_shop', 'estetica_massagem', 'outro'] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export function isBusinessType(value: string): value is BusinessType {
  return (BUSINESS_TYPES as readonly string[]).includes(value);
}
