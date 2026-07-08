'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendAgentReply, type ReplyState } from './actions';

const initialState: ReplyState = {};

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Enviando...' : 'Enviar'}
    </button>
  );
}

export function ReplyForm({ ticketId }: { ticketId: string }) {
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
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {state?.error && (
        <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>
      )}
      <textarea
        name="content"
        required
        rows={3}
        placeholder="Escreva sua resposta para o cliente..."
        style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 13.5, fontFamily: 'inherit' }}
      />
      <div>
        <SendButton />
      </div>
    </form>
  );
}
