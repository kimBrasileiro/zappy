'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { UserFormState } from './actions';

const initialState: UserFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar alterações'}
    </button>
  );
}

export function UserForm({
  action,
  email,
  defaultValues,
}: {
  action: (prevState: UserFormState, formData: FormData) => Promise<UserFormState>;
  email: string;
  defaultValues: { name: string; role: string };
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>Email</label>
        <input value={email} disabled />
      </div>
      <div className="dash-form-row">
        <label>Nome</label>
        <input name="name" required defaultValue={defaultValues.name} />
      </div>
      <div className="dash-form-row">
        <label>Role</label>
        <select name="role" defaultValue={defaultValues.role}>
          <option value="admin">admin</option>
          <option value="agent">agent</option>
          <option value="viewer">viewer</option>
        </select>
      </div>
      <SubmitButton />
    </form>
  );
}
