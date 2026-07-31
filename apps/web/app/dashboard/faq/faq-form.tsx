'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { FaqFormState } from './actions';

const initialState: FaqFormState = {};

function SubmitButton({ label }: { label: string }) {
  const t = useTranslations('dashboard.faq');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? t('saving') : label}
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
  const t = useTranslations('dashboard.faq');
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>{t('formQuestionLabel')}</label>
        <input name="question" required defaultValue={defaultValues?.question} placeholder={t('formQuestionPlaceholder')} />
      </div>
      <div className="dash-form-row">
        <label>{t('formAnswerLabel')}</label>
        <textarea name="answer" required rows={4} defaultValue={defaultValues?.answer} />
      </div>
      <SubmitButton label={submitLabel} />
    </form>
  );
}
