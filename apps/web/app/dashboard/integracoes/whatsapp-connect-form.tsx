'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { connectWhatsAppNumber, type ConnectWhatsAppState } from './actions';

const initialState: ConnectWhatsAppState = {};

function SubmitButton() {
  const t = useTranslations('dashboard.integrations');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? t('whatsappConnecting') : t('whatsappConnectButton')}
    </button>
  );
}

export function WhatsAppConnectForm() {
  const t = useTranslations('dashboard.integrations');
  const [state, formAction] = useFormState(connectWhatsAppNumber, initialState);

  return (
    <form action={formAction}>
      {state?.error && <div className="dash-form-error">{state.error}</div>}
      <label className="dash-form-row">
        {t('whatsappPhoneNumberIdLabel')}
        <input name="phoneNumberId" required placeholder={t('whatsappPhoneNumberIdPlaceholder')} />
      </label>
      <label className="dash-form-row">
        {t('whatsappAccessTokenLabel')}
        <input name="accessToken" type="password" required placeholder={t('whatsappAccessTokenPlaceholder')} />
      </label>
      <SubmitButton />
    </form>
  );
}
