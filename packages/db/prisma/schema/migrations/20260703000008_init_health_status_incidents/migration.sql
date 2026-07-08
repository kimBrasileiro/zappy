CREATE TABLE health_status (
  service TEXT PRIMARY KEY,
  service_type TEXT NOT NULL,         -- ai_provider | database | queue | integration
  status TEXT NOT NULL DEFAULT 'up',  -- up | degraded | down
  latency_ms INTEGER,
  last_check TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE health_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  service_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  notified BOOLEAN DEFAULT false
);
CREATE INDEX idx_incidents_open ON health_incidents(service) WHERE resolved_at IS NULL;
