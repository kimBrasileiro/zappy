import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { getStripe, isStripeConfigured } from '../../../lib/stripe/client';
import { PLANS, FREE_TIER_MODE } from '../../../lib/stripe/plans';
import { cancelSubscription, reactivateSubscription } from './actions';
import { ChangePlanForm } from './change-plan-form';

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Em teste (trial)',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  incomplete: 'Aguardando pagamento',
  incomplete_expired: 'Expirada',
  unpaid: 'Não paga',
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function BillingPage() {
  const { companyId } = await requireSession();
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  if (!isStripeConfigured()) {
    return (
      <>
        <h1 className="dash-h1">Assinatura</h1>
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
                Período de lançamento — grátis
              </span>
              <p style={{ color: '#555', fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
                Sua conta usa a Zappigo sem custo, com o número
                de WhatsApp compartilhado da plataforma — sem cartão, sem cobrança. Se isso mudar
                no futuro, avisamos com bastante antecedência antes de qualquer cobrança começar.
              </p>
            </>
          ) : (
            <p style={{ color: '#999', fontSize: 13.5, margin: 0 }}>
              Cobrança ainda não está configurada nesta instância — fale com o suporte.
            </p>
          )}
        </div>
      </>
    );
  }

  if (!company.stripeSubscriptionId) {
    return (
      <>
        <h1 className="dash-h1">Assinatura</h1>
        <div className="dash-card">
          <p style={{ color: '#999', fontSize: 13.5, margin: 0 }}>
            Sua empresa ainda não tem uma assinatura ativa.
          </p>
        </div>
      </>
    );
  }

  const subscription = await getStripe().subscriptions.retrieve(company.stripeSubscriptionId, {
    expand: ['items.data.price'],
  });

  const price = subscription.items.data[0]?.price;
  const amount = price?.unit_amount != null ? formatBRL(price.unit_amount) : null;
  const interval = price?.recurring?.interval === 'month' ? '/mês' : '';

  const currentPlanLabel = PLANS.find((p) => p.key === company.plan)?.label ?? company.plan;
  const periodEndDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('pt-BR');
  const trialEndDate = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toLocaleDateString('pt-BR')
    : null;

  return (
    <>
      <h1 className="dash-h1">Assinatura</h1>
      <p className="dash-subtitle">Veja seu plano atual, troque de plano ou cancele quando quiser.</p>

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
            {STATUS_LABELS[subscription.status] ?? subscription.status}
          </span>
        </div>

        {subscription.status === 'trialing' && trialEndDate && (
          <p style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>
            Seu trial termina em {trialEndDate} — o cartão cadastrado será cobrado automaticamente depois disso.
          </p>
        )}

        {subscription.cancel_at_period_end ? (
          <>
            <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 14 }}>
              Sua assinatura foi marcada para cancelar em {periodEndDate}. Você continua com acesso normal até lá.
            </p>
            <form action={reactivateSubscription}>
              <button type="submit" className="dash-btn">
                Reativar assinatura
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>Próxima cobrança em {periodEndDate}.</p>
            <form action={cancelSubscription}>
              <button type="submit" className="dash-btn dash-btn-danger">
                Cancelar assinatura
              </button>
            </form>
          </>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Mudar de plano</h3>
        <ChangePlanForm currentPlan={company.plan} />
      </div>
    </>
  );
}
