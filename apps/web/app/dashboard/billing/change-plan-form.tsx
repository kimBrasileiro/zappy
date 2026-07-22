'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changePlan, type ChangePlanState } from './actions';
import { PLANS } from '../../../lib/stripe/plans';

const initialState: ChangePlanState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="dash-btn">
      {pending ? 'Alterando...' : 'Confirmar troca de plano'}
    </button>
  );
}

export function ChangePlanForm({ currentPlan }: { currentPlan: string }) {
  const [state, formAction] = useFormState(changePlan, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
      {PLANS.map((p) => (
        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
          <input type="radio" name="plan" value={p.key} defaultChecked={p.key === currentPlan} />
          {p.label} — {p.price}
          {p.key === currentPlan && <span style={{ color: '#16a34a', fontSize: 12 }}>(plano atual)</span>}
        </label>
      ))}
      <div>
        <SubmitButton />
      </div>
      <p style={{ color: '#999', fontSize: 12, margin: 0 }}>
        Troca é imediata e com valor proporcional: em upgrade, a diferença é cobrada agora; em downgrade, você
        recebe crédito na próxima fatura.
      </p>
    </form>
  );
}
