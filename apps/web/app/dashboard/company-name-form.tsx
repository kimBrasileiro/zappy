'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateCompanyProfile, type CompanyProfileFormState } from './actions';

const initialState: CompanyProfileFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn dash-btn-secondary" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar'}
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
  const [state, formAction] = useFormState(updateCompanyProfile, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <div className="dash-form-row" style={{ marginBottom: 0, width: '100%', maxWidth: 480 }}>
        <input name="name" required defaultValue={defaultName} placeholder="Nome da empresa" />
      </div>
      <div className="dash-form-row" style={{ marginBottom: 0, width: '100%', maxWidth: 480 }}>
        <textarea
          name="description"
          defaultValue={defaultDescription}
          placeholder="Descrição curta da empresa — aparece na sua página pública (ex: Pet shop com banho, tosa e consultas veterinárias no bairro X)"
          rows={3}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <SubmitButton />
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
    </form>
  );
}
