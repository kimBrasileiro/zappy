import { getTranslations } from 'next-intl/server';
import { runHealthChecks } from '../../../lib/health/checks';
import { RefreshButton } from '../../dashboard/refresh-button';

const STATUS_COLOR: Record<string, string> = {
  ok: '#166534',
  error: '#b91c1c',
  not_configured: '#999',
};

const STATUS_BG: Record<string, string> = {
  ok: '#f0fdf4',
  error: '#fef2f2',
  not_configured: '#f8f9fb',
};

export default async function HealthPage() {
  const t = await getTranslations('admin.health');
  const results = await runHealthChecks();

  const statusLabel: Record<string, string> = {
    ok: t('statusOk'),
    error: t('statusError'),
    not_configured: t('statusNotConfigured'),
  };

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {results.map((r) => (
          <div
            key={r.name}
            className="dash-card"
            style={{ margin: 0, background: STATUS_BG[r.status], border: `1px solid ${STATUS_COLOR[r.status]}22` }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>{r.name}</strong>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: STATUS_COLOR[r.status],
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
                {statusLabel[r.status]}
              </span>
            </div>
            {r.detail && <p style={{ fontSize: 12.5, color: '#555', margin: '0 0 4px', lineHeight: 1.5 }}>{r.detail}</p>}
            {r.latencyMs !== undefined && <p style={{ fontSize: 11, color: '#999', margin: 0 }}>{r.latencyMs}ms</p>}
          </div>
        ))}
      </div>
    </>
  );
}
