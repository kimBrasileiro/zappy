'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { sendSupportMessage, type SupportFormState } from './actions';

const initialState: SupportFormState = {};

function SubmitButton() {
  const t = useTranslations('dashboard.support');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? t('sending') : t('sendButton')}
    </button>
  );
}

export function SupportForm() {
  const t = useTranslations('dashboard.support');
  const [state, formAction] = useFormState(sendSupportMessage, initialState);

  if (state?.sent) {
    return (
      <p style={{ color: '#166534', fontSize: 14 }}>
        {t('sentMessage')}
      </p>
    );
  }

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>{t('categoryLabel')}</label>
        <select name="category" defaultValue="duvida">
          <option value="bug">{t('categoryBug')}</option>
          <option value="duvida">{t('categoryDuvida')}</option>
          <option value="sugestao">{t('categorySugestao')}</option>
          <option value="outro">{t('categoryOutro')}</option>
        </select>
      </div>
      <div className="dash-form-row">
        <label>{t('messageLabel')}</label>
        <textarea
          name="message"
          rows={6}
          required
          placeholder={t('messagePlaceholder')}
        />
      </div>
      <SubmitButton />
    </form>
  );
}
