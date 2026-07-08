export type CompanyPlan = 'starter' | 'growth' | 'enterprise';
export type CompanyStatus = 'active' | 'suspended' | 'cancelled';

export interface CompanyDTO {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  status: CompanyStatus;
}
