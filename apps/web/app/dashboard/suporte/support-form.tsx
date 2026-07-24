'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendSupportMessage, type SupportFormState } from './actions';

const initialState: SupportFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Enviando...' : 'Enviar'}
    </button>
  );
}

export function SupportForm() {
  const [state, formAction] = useFormState(sendSupportMessage, initialState);

  if (state?.sent) {
    return (
      <p style={{ color: '#166534', fontSize: 14 }}>
        Mensagem enviada! A gente responde por email o quanto antes.
      </p>
    );
  }

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>Categoria</label>
        <select name="category" defaultValue="duvida">
          <option value="bug">Bug / problema técnico</option>
          <option value="duvida">Dúvida</option>
          <option value="sugestao">Sugestão</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      <div className="dash-form-row">
        <label>Mensagem</label>
        <textarea
          name="message"
          rows={6}
          required
          placeholder="Descreve o que aconteceu, ou o que você gostaria de sugerir..."
        />
      </div>
      <SubmitButton />
    </form>
  );
}
