'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { regenerateLeadsAction } from './actions';

export function GenerateButton() {
  const t = useTranslations('dashboard.leads');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await regenerateLeadsAction();
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={handleClick} className="dash-btn" disabled={isPending}>
      {isPending ? t('generating') : t('generateButton')}
    </button>
  );
}
