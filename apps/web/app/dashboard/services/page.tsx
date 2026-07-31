import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { createService, deleteService, toggleServiceActive } from './actions';
import { ServiceForm } from './service-form';
import { RefreshButton } from '../refresh-button';

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0 && minutes >= 60) return `${minutes / 60}h`;
  return `${minutes} min`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function ServicesPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.services');

  const services = await prisma.service.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">{t('title')}</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            {t('subtitle')}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-card">
        <ServiceForm action={createService} submitLabel={t('createLabel')} />
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('tableName')}</th>
            <th>{t('tableDuration')}</th>
            <th>{t('tablePrice')}</th>
            <th>{t('tableBookingMode')}</th>
            <th>{t('tableStatus')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <td>
                <Link href={`/dashboard/services/${service.id}`}>{service.name}</Link>
                {service.is24h && (
                  <span className="dash-badge dash-badge-in_progress" style={{ marginLeft: 8 }}>
                    {t('badge24h')}
                  </span>
                )}
                {service.cancellationNoticeHours > 0 && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {t('cancellationNotice', { hours: service.cancellationNoticeHours })}
                    {service.cancellationFeeCents > 0 &&
                      t('cancellationFeeNote', { fee: formatPrice(service.cancellationFeeCents) })}
                  </div>
                )}
                {service.staffNames.length > 0 && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {t('staffLabel', { names: service.staffNames.join(', ') })}
                  </div>
                )}
              </td>
              <td>{formatDuration(service.durationMinutes)}</td>
              <td>{formatPrice(service.priceCents)}</td>
              <td>{service.bookingMode === 'manual' ? t('bookingModeManual') : t('bookingModeAuto')}</td>
              <td>
                <span className={service.active ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {service.active ? t('statusActive') : t('statusInactive')}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <form action={toggleServiceActive.bind(null, service.id)}>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {service.active ? t('deactivate') : t('activate')}
                  </button>
                </form>
                <form action={deleteService.bind(null, service.id)}>
                  <button type="submit" className="dash-btn dash-btn-danger">
                    {t('delete')}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {services.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: '#999' }}>
                {t('noServices')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
