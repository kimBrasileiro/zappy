import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { disconnectGoogleCalendar, disconnectWhatsAppNumber } from './actions';
import { formatDate } from '../../../lib/format-time';
import { WhatsAppConnectForm } from './whatsapp-connect-form';

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.integrations');
  const locale = await getLocale();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      googleCalendarId: true,
      googleCalendarRefreshTokenEncrypted: true,
      googleCalendarConnectedEmail: true,
      googleCalendarConnectedAt: true,
      whatsappPhoneId: true,
      whatsappConnectedNumber: true,
      whatsappConnectedAt: true,
    },
  });
  if (!company) return null;

  const errorMessages: Record<string, string> = {
    invalid_state: t('errorInvalidState'),
    connect_failed: t('errorConnectFailed'),
  };

  const { connected, error } = await searchParams;
  const isConnected = !!company.googleCalendarId && !!company.googleCalendarRefreshTokenEncrypted;
  const isWhatsAppConnected = !!company.whatsappPhoneId;

  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">{t('subtitle')}</p>

      {connected === '1' && (
        <div className="dash-card" style={{ background: '#ecfdf3', borderColor: '#bbf7d0' }}>
          <p style={{ margin: 0, color: '#166534', fontSize: 13.5 }}>{t('connectedSuccess')}</p>
        </div>
      )}
      {error && (
        <div className="dash-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
          <p style={{ margin: 0, color: '#991b1b', fontSize: 13.5 }}>
            {errorMessages[error] ?? t('errorGeneric')}
          </p>
        </div>
      )}

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('googleCalendarTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          {t('googleCalendarBody')}
        </p>

        {isConnected ? (
          <>
            <p style={{ fontSize: 13.5, margin: '0 0 14px' }}>
              {t('connectedAsPrefix')} <strong>{company.googleCalendarConnectedEmail}</strong>
              {company.googleCalendarConnectedAt && (
                <span style={{ color: '#999' }}>
                  {t('connectedSince', { date: formatDate(company.googleCalendarConnectedAt, locale) })}
                </span>
              )}
              .
            </p>
            <form action={disconnectGoogleCalendar}>
              <button type="submit" className="dash-btn dash-btn-secondary">
                {t('disconnectButton')}
              </button>
            </form>
          </>
        ) : (
          <a href="/api/integrations/google-calendar/authorize" className="dash-btn" style={{ textDecoration: 'none' }}>
            {t('connectButton')}
          </a>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('whatsappOwnTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          {t('whatsappOwnBody')}
        </p>

        {isWhatsAppConnected ? (
          <>
            <p style={{ fontSize: 13.5, margin: '0 0 14px' }}>
              {t('connectedAsPrefix')} <strong>{company.whatsappConnectedNumber}</strong>
              {company.whatsappConnectedAt && (
                <span style={{ color: '#999' }}>
                  {t('connectedSince', { date: formatDate(company.whatsappConnectedAt, locale) })}
                </span>
              )}
              .
            </p>
            <form action={disconnectWhatsAppNumber}>
              <button type="submit" className="dash-btn dash-btn-secondary">
                {t('disconnectButton')}
              </button>
            </form>
          </>
        ) : (
          <WhatsAppConnectForm />
        )}
      </div>
    </>
  );
}
