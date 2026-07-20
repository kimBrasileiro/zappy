'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateAllowedDomains, type DomainsFormState } from './actions';

const initialState: DomainsFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar domínios'}
    </button>
  );
}

export function DomainsForm({ defaultDomains }: { defaultDomains: string[] }) {
  const [state, formAction] = useFormState(updateAllowedDomains, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
      <textarea
        name="domains"
        rows={4}
        placeholder={'meusite.com.br\nwww.meusite.com.br'}
        defaultValue={defaultDomains.join('\n')}
        style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 13.5, fontFamily: 'inherit' }}
      />
      <div>
        <SaveButton />
      </div>
    </form>
  );
}
