'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateCompanyName, type CompanyNameFormState } from './actions';

const initialState: CompanyNameFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn dash-btn-secondary" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar'}
    </button>
  );
}

export function CompanyNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction] = useFormState(updateCompanyName, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div className="dash-form-row" style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}>
        <input name="name" required defaultValue={defaultName} placeholder="Nome da empresa" />
      </div>
      <SubmitButton />
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
    </form>
  );
}
