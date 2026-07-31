'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { updateCompanyProfile, type CompanyProfileFormState } from './actions';

const initialState: CompanyProfileFormState = {};

function SubmitButton() {
  const t = useTranslations('dashboard.home');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn dash-btn-secondary" disabled={pending}>
      {pending ? t('saving') : t('saveButton')}
    </button>
  );
}

export function CompanyProfileForm({
  defaultName,
  defaultDescription,
}: {
  defaultName: string;
  defaultDescription: string;
}) {
  const t = useTranslations('dashboard.home');
  const [state, formAction] = useFormState(updateCompanyProfile, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <div className="dash-form-row" style={{ marginBottom: 0, width: '100%', maxWidth: 480 }}>
        <input name="name" required defaultValue={defaultName} placeholder={t('companyNamePlaceholder')} />
      </div>
      <div className="dash-form-row" style={{ marginBottom: 0, width: '100%', maxWidth: 480 }}>
        <textarea
          name="description"
          defaultValue={defaultDescription}
          placeholder={t('companyDescriptionPlaceholder')}
          rows={3}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <SubmitButton />
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
    </form>
  );
}
