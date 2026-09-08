'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { NotesFormState } from './actions';

const initialState: NotesFormState = {};

function SaveButton() {
  const t = useTranslations('dashboard.clients');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? t('notesSaving') : t('notesSave')}
    </button>
  );
}

export function NotesForm({
  action,
  defaultNotes,
}: {
  action: (prevState: NotesFormState, formData: FormData) => Promise<NotesFormState>;
  defaultNotes: string;
}) {
  const t = useTranslations('dashboard.clients');
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction}>
      <div className="dash-form-row">
        <textarea name="notes" rows={4} defaultValue={defaultNotes} placeholder={t('notesPlaceholder')} />
      </div>
      {state.success && <p style={{ color: '#166534', fontSize: 13, margin: '0 0 10px' }}>{t('notesSaved')}</p>}
      <SaveButton />
    </form>
  );
}
