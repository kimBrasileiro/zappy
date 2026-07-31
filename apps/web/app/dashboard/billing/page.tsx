import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { getStripe, isStripeConfigured } from '../../../lib/stripe/client';
import { PLANS, FREE_TIER_MODE } from '../../../lib/stripe/plans';
import { PRICING_CURRENCY_CODE } from '../../../lib/pricing';
import { cancelSubscription, reactivateSubscription } from './actions';
import { ChangePlanForm } from './change-plan-form';

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: PRICING_CURRENCY_CODE });
}

export default async function BillingPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.billing');
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const statusLabels: Record<string, string> = {
    trialing: t('statusTrialing'),
    active: t('statusActive'),
    past_due: t('statusPastDue'),
    canceled: t('statusCanceled'),
    incomplete: t('statusIncomplete'),
    incomplete_expired: t('statusIncompleteExpired'),
    unpaid: t('statusUnpaid'),
  };

  const planLabels: Record<string, string> = {
    basico: t('planBasico'),
    whatsapp_proprio: t('planWhatsappProprio'),
    integracao: t('planIntegracao'),
  };

  if (!isStripeConfigured()) {
    return (
      <>
        <h1 className="dash-h1">{t('title')}</h1>
        <div className="dash-card">
          {FREE_TIER_MODE ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  background: '#dcfce7',
                  color: '#166534',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 999,
                  marginBottom: 10,
                }}
              >
                {t('launchBadge')}
              </span>
              <p style={{ color: '#555', fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
                {t('launchBody')}
              </p>
            </>
          ) : (
            <p style={{ color: '#999', fontSize: 13.5, margin: 0 }}>
              {t('billingNotConfigured')}
            </p>
          )}
        </div>
      </>
    );
  }

  if (!company.stripeSubscriptionId) {
    return (
      <>
        <h1 className="dash-h1">{t('title')}</h1>
        <div className="dash-card">
          <p style={{ color: '#999', fontSize: 13.5, margin: 0 }}>
            {t('noActiveSubscription')}
          </p>
        </div>
      </>
    );
  }

  const subscription = await getStripe().subscriptions.retrieve(company.stripeSubscriptionId, {
    expand: ['items.data.price'],
  });

  const price = subscription.items.data[0]?.price;
  const amount = price?.unit_amount != null ? formatPrice(price.unit_amount) : null;
  const interval = price?.recurring?.interval === 'month' ? t('perMonthSuffix') : '';

  const currentPlanLabel = planLabels[company.plan] ?? PLANS.find((p) => p.key === company.plan)?.label ?? company.plan;
  const periodEndDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('pt-BR');
  const trialEndDate = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toLocaleDateString('pt-BR')
    : null;

  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">{t('subtitle')}</p>

      <div className="dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 17, margin: '0 0 4px' }}>{currentPlanLabel}</h3>
            {amount && (
              <p style={{ color: '#666', fontSize: 13.5, margin: 0 }}>
                {amount}
                {interval}
              </p>
            )}
          </div>
          <span className={`dash-badge dash-badge-${subscription.status}`}>
            {statusLabels[subscription.status] ?? subscription.status}
          </span>
        </div>

        {subscription.status === 'trialing' && trialEndDate && (
          <p style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>
            {t('trialEndsAt', { date: trialEndDate })}
          </p>
        )}

        {subscription.cancel_at_period_end ? (
          <>
            <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 14 }}>
              {t('willCancelAt', { date: periodEndDate })}
            </p>
            <form action={reactivateSubscription}>
              <button type="submit" className="dash-btn">
                {t('reactivateButton')}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>{t('nextChargeAt', { date: periodEndDate })}</p>
            <form action={cancelSubscription}>
              <button type="submit" className="dash-btn dash-btn-danger">
                {t('cancelButton')}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>{t('changePlanTitle')}</h3>
        <ChangePlanForm currentPlan={company.plan} />
      </div>
    </>
  );
}
