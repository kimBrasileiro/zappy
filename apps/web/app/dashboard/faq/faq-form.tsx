'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { FaqFormState } from './actions';

const initialState: FaqFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Salvando...' : label}
    </button>
  );
}

export function FaqForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: FaqFormState, formData: FormData) => Promise<FaqFormState>;
  defaultValues?: { question: string; answer: string };
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>Pergunta</label>
        <input name="question" required defaultValue={defaultValues?.question} placeholder="Qual o horário de funcionamento?" />
      </div>
      <div className="dash-form-row">
        <label>Resposta</label>
        <textarea name="answer" required rows={4} defaultValue={defaultValues?.answer} />
      </div>
      <SubmitButton label={submitLabel} />
    </form>
  );
}
