-- The original idx_bookings_no_double_book (service_id, scheduled_at) predates
-- staff scheduling: it unconditionally forbids two confirmed bookings for the
-- same service at the same instant, which is wrong now that a service can have
-- multiple staff members legitimately holding the same slot. Replaced with an
-- index scoped to (service_id, scheduled_at, staff_name) instead — still one
-- row per instant for services with no staff concept (staff_name always NULL
-- there, COALESCE'd to '' since Postgres treats NULL <> NULL and would
-- otherwise stop enforcing uniqueness entirely for those services).
DROP INDEX idx_bookings_no_double_book;

CREATE UNIQUE INDEX idx_bookings_no_double_book ON bookings(service_id, scheduled_at, COALESCE(staff_name, ''))
  WHERE status = 'confirmed';
