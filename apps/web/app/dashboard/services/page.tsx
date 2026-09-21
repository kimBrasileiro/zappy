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
  // Autocomplete suggestions for the new-service form's staff rows — every
  // name already in use somewhere in this company's catalog.
  const existingStaffNames = [...new Set(services.flatMap((s) => s.staffNames))].sort();
  const existingCategories = [...new Set(services.map((s) => s.category).filter((c): c is string => !!c))].sort();

  // Grouped for display — a service with no category falls into a final
  // "Outros" bucket rather than being hidden or erroring. Insertion order
  // of categories follows each one's first appearance in `services` (itself
  // already createdAt-desc), not alphabetical — matches how the rest of
  // this page already orders things.
  const UNCATEGORIZED = t('categoryUncategorized');
  const groups = new Map<string, typeof services>();
  for (const service of services) {
    const key = service.category ?? UNCATEGORIZED;
    const group = groups.get(key);
    if (group) group.push(service);
    else groups.set(key, [service]);
  }
  if (groups.has(UNCATEGORIZED)) {
    const uncategorized = groups.get(UNCATEGORIZED)!;
    groups.delete(UNCATEGORIZED);
    groups.set(UNCATEGORIZED, uncategorized);
  }

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
        <ServiceForm
          action={createService}
          existingStaffNames={existingStaffNames}
          existingCategories={existingCategories}
          submitLabel={t('createLabel')}
        />
      </div>

      {services.length === 0 && <p style={{ color: '#999' }}>{t('noServices')}</p>}

      {[...groups.entries()].map(([category, group]) => (
        <div key={category}>
          <div className="dash-section-title">{category}</div>
          <div className="dash-table-wrap">
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
                {group.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {service.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded GCS URL, not a static/optimizable local asset
                          <img
                            src={service.photoUrl}
                            alt=""
                            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                          />
                        )}
                        <div>
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
                        </div>
                      </div>
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
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
