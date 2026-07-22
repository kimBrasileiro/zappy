ALTER TABLE services
  ADD COLUMN cancellation_notice_hours INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN cancellation_fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN staff_names TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE bookings
  ADD COLUMN staff_name TEXT;

CREATE TABLE staff_absences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  staff_name  TEXT NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, staff_name, date)
);

CREATE INDEX idx_staff_absences_company ON staff_absences (company_id);
