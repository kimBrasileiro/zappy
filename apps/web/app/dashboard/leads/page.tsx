import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { formatDateTime } from '../../../lib/format-time';
import { PRICING_CURRENCY_CODE } from '../../../lib/pricing';
import { Avatar } from '../avatar';
import { GenerateButton } from './generate-button';

function formatPrice(cents: number, locale: string): string {
  return (cents / 100).toLocaleString(locale, { style: 'currency', currency: PRICING_CURRENCY_CODE });
}

export default async function LeadsPage() {
  const { companyId } = await requireSession();
  const [t, locale] = await Promise.all([getTranslations('dashboard.leads'), getLocale()]);

  const leads = await prisma.lead.findMany({
    where: { companyId },
    orderBy: { lastMessageAt: 'desc' },
  });

  const totalPotentialCents = leads.reduce((sum, l) => sum + (l.priceCents ?? 0), 0);
  const generatedAt = leads[0]?.generatedAt;

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')}
          </p>
        </div>
        <GenerateButton />
      </div>

      <div className="dash-stat-grid">
        <div className="dash-stat-tile">
          <span className="dash-stat-value">{leads.length}</span>
          <span className="dash-stat-label">{t('leadsCountLabel')}</span>
        </div>
        <div className="dash-stat-tile dash-stat-green">
          <span className="dash-stat-value">{formatPrice(totalPotentialCents, locale)}</span>
          <span className="dash-stat-label">{t('totalPotentialLabel')}</span>
        </div>
      </div>

      <p className="dash-subtitle">{generatedAt ? t('generatedAt', { date: formatDateTime(generatedAt, locale) }) : t('neverGenerated')}</p>

      {leads.length === 0 ? (
        <div className="dash-card" style={{ color: '#999' }}>
          {generatedAt ? t('noLeads') : t('emptyBeforeGeneration')}
        </div>
      ) : (
        <div className="dash-list">
          {leads.map((lead) => (
            <Link key={lead.id} href={`/dashboard/conversations/${lead.ticketId}`} className="dash-list-item">
              <Avatar name={lead.customerName} seed={lead.customerId ?? lead.ticketId} className="dash-list-avatar" size={38} />
              <div className="dash-list-body">
                <div className="dash-list-name-row">
                  <span className="dash-list-name">{lead.customerName ?? t('noContact')}</span>
                  <span className="dash-list-time">{lead.priceCents != null ? formatPrice(lead.priceCents, locale) : '—'}</span>
                </div>
                <div className="dash-list-preview">
                  {lead.serviceName} · {lead.draftDate}
                  {lead.customerPhone ? ` · ${lead.customerPhone}` : ''}
                </div>
              </div>
              <div className="dash-list-meta">
                <span className="dash-channel-badge">{lead.channel}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
