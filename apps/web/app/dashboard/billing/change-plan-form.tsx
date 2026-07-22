'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { changePlan, type ChangePlanState } from './actions';
import { PLANS, planRank } from '../../../lib/stripe/plans';

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
  const currentRank = planRank(currentPlan);
  // Upgrade-only self-service (see actions.ts#changePlan, which enforces
  // this server-side too) — a plan below the current one isn't even offered
  // as a clickable option here, not just disabled.
  const upgradablePlans = PLANS.filter((p) => planRank(p.key) >= currentRank);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{state.error}</div>}
      {upgradablePlans.map((p) => (
        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
          <input type="radio" name="plan" value={p.key} defaultChecked={p.key === currentPlan} />
          {p.label} — {p.price}
          {p.key === currentPlan && <span style={{ color: '#16a34a', fontSize: 12 }}>(plano atual)</span>}
        </label>
      ))}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#555', marginTop: 4 }}>
        <input type="checkbox" name="confirm" required style={{ marginTop: 2 }} />
        <span>
          Confirmo que quero trocar de plano agora (cobrança proporcional imediata) e aceito os{' '}
          <Link href="/terms" target="_blank" style={{ color: '#2563eb' }}>
            Termos de Uso
          </Link>
          .
        </span>
      </label>

      <div>
        <SubmitButton />
      </div>
      <p style={{ color: '#999', fontSize: 12, margin: 0 }}>
        Troca é imediata e com valor proporcional — a diferença é cobrada agora. Precisa reduzir de plano? Fale com o
        suporte.
      </p>
    </form>
  );
}
