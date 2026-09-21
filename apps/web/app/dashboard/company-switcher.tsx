'use client';

import { impersonateCompany } from './impersonate-actions';

export function CompanySwitcher({
  companies,
  currentCompanyId,
}: {
  companies: { id: string; name: string; slug: string }[];
  currentCompanyId: string;
}) {
  return (
    <form action={impersonateCompany} style={{ padding: '0 8px', marginBottom: 4 }}>
      <select
        name="companyId"
        defaultValue={currentCompanyId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{
          width: '100%',
          background: '#f9fafb',
          color: '#111827',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '7px 8px',
          fontSize: 12.5,
        }}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.slug === 'zappigo' ? '(Zappigo)' : ''}
          </option>
        ))}
      </select>
    </form>
  );
}
