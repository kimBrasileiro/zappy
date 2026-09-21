// A company's "modality" decides which booking model it runs on:
//  - 'appointments' (default, and what every company that existed before
//    this was): one customer ↔ one exclusive slot — Service/Booking,
//    barbearia, pet shop, salão, etc.
//  - 'sports_classes': group classes with seats, levels and courts —
//    lib/sports/*, sports.prisma.
// Read from Company.config (the same free-form bag botName/address/
// extraInstructions live in) rather than a new column, so no migration and no
// existing row needs touching: a missing key IS 'appointments'. Every
// sports-only code path is gated on isSportsCompany() so the appointments
// paths stay byte-for-byte what they were.
export type Modality = 'appointments' | 'sports_classes';

export function getModality(company: { config: unknown }): Modality {
  const config = company.config as { modality?: string } | null;
  return config?.modality === 'sports_classes' ? 'sports_classes' : 'appointments';
}

export function isSportsCompany(company: { config: unknown }): boolean {
  return getModality(company) === 'sports_classes';
}
