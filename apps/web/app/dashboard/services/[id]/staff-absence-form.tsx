'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { StaffAbsenceFormState } from '../actions';

const initialState: StaffAbsenceFormState = {};

function SubmitButton() {
  const t = useTranslations('dashboard.services');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn dash-btn-secondary" disabled={pending}>
      {pending ? t('marking') : t('markAbsence')}
    </button>
  );
}

export function StaffAbsenceForm({
  action,
  staffNames,
}: {
  action: (prevState: StaffAbsenceFormState, formData: FormData) => Promise<StaffAbsenceFormState>;
  staffNames: string[];
}) {
  const t = useTranslations('dashboard.services');
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="dash-form-row" style={{ marginBottom: 0 }}>
        <label>{t('tablePerson')}</label>
        <select name="staffName" required>
          {staffNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="dash-form-row" style={{ marginBottom: 0 }}>
        <label>{t('dayOffLabel')}</label>
        <input name="date" type="date" required />
      </div>
      <SubmitButton />
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
    </form>
  );
}
