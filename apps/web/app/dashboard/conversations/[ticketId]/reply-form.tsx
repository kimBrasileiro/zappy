'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { sendAgentReply, type ReplyState } from './actions';

const initialState: ReplyState = {};

function SendButton() {
  const t = useTranslations('dashboard.conversations');
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? t('sending') : t('sendButton')}
    </button>
  );
}

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations('dashboard.conversations');
  const action = sendAgentReply.bind(null, ticketId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="dash-card"
    >
      {state?.error && <div className="dash-form-error">{state.error}</div>}
      <div className="dash-form-row">
        <textarea name="content" required rows={3} placeholder={t('replyPlaceholder')} />
      </div>
      <div>
        <SendButton />
      </div>
    </form>
  );
}
