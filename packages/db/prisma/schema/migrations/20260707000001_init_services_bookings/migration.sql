CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_company ON services(company_id);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  customer_id UUID REFERENCES customers(id),
  ticket_id UUID REFERENCES tickets(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,          -- snapshotted from the service at booking time
  price_cents INTEGER NOT NULL,               -- snapshotted from the service at booking time
  status TEXT NOT NULL DEFAULT 'confirmed',   -- confirmed | cancelled | completed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_company ON bookings(company_id);
CREATE INDEX idx_bookings_service_scheduled ON bookings(service_id, scheduled_at);

-- Defense in depth against the application-level availability check racing
-- itself: the database refuses a second CONFIRMED booking for the same
-- service at the exact same instant. Not the primary mechanism (that's the
-- re-check inside create_booking) — a backstop.
CREATE UNIQUE INDEX idx_bookings_no_double_book ON bookings(service_id, scheduled_at)
  WHERE status = 'confirmed';
