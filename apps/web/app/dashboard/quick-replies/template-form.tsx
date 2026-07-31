'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { TemplateFormState } from './actions';

const initialState: TemplateFormState = {};

function SubmitButton({ label }: { label: string }) {
  const t = useTranslations('dashboard.quickReplies');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? t('saving') : label}
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
  const t = useTranslations('dashboard.quickReplies');
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>{t('formNameLabel')}</label>
        <input name="name" required defaultValue={defaultValues?.name} />
      </div>
      <div className="dash-form-row">
        <label>{t('formShortcutLabel')}</label>
        <input name="shortcut" defaultValue={defaultValues?.shortcut ?? ''} />
      </div>
      <div className="dash-form-row">
        <label>{t('formCategoryLabel')}</label>
        <input name="category" defaultValue={defaultValues?.category ?? ''} />
      </div>
      <div className="dash-form-row">
        <label>{t('formContentLabel')}</label>
        <textarea name="content" required rows={4} defaultValue={defaultValues?.content} />
      </div>
      <SubmitButton label={submitLabel} />
    </form>
  );
}
