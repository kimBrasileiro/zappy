'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { ArticleFormState } from './actions';

const initialState: ArticleFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Salvando...' : label}
    </button>
  );
}

export function ArticleForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ArticleFormState, formData: FormData) => Promise<ArticleFormState>;
  defaultValues?: { title: string; content: string; category: string | null };
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>Título</label>
        <input name="title" required defaultValue={defaultValues?.title} />
      </div>
      <div className="dash-form-row">
        <label>Categoria (opcional)</label>
        <input name="category" defaultValue={defaultValues?.category ?? ''} />
      </div>
      <div className="dash-form-row">
        <label>Conteúdo</label>
        <textarea name="content" required rows={5} defaultValue={defaultValues?.content} />
      </div>
      <SubmitButton label={submitLabel} />
    </form>
  );
}
