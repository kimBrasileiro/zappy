'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { StaffAbsenceFormState } from '../actions';

const initialState: StaffAbsenceFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn dash-btn-secondary" disabled={pending}>
      {pending ? 'Marcando...' : 'Marcar ausência'}
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
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="dash-form-row" style={{ marginBottom: 0 }}>
        <label>Pessoa</label>
        <select name="staffName" required>
          {staffNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="dash-form-row" style={{ marginBottom: 0 }}>
        <label>Dia sem atendimento</label>
        <input name="date" type="date" required />
      </div>
      <SubmitButton />
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
    </form>
  );
}
