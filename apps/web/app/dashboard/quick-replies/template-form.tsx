'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { TemplateFormState } from './actions';

const initialState: TemplateFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Salvando...' : label}
    </button>
  );
}

export function TemplateForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  defaultValues?: { name: string; content: string; shortcut: string | null; category: string | null };
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>Nome</label>
        <input name="name" required defaultValue={defaultValues?.name} />
      </div>
      <div className="dash-form-row">
        <label>Atalho (opcional, ex: /reembolso)</label>
        <input name="shortcut" defaultValue={defaultValues?.shortcut ?? ''} />
      </div>
      <div className="dash-form-row">
        <label>Categoria (opcional)</label>
        <input name="category" defaultValue={defaultValues?.category ?? ''} />
      </div>
      <div className="dash-form-row">
        <label>Conteúdo</label>
        <textarea name="content" required rows={4} defaultValue={defaultValues?.content} />
      </div>
      <SubmitButton label={submitLabel} />
    </form>
  );
}
