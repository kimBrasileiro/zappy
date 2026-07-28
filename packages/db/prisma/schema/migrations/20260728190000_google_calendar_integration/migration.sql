-- Google Calendar integration: per-company connection (all nullable, opt-in)
-- and the event id on each booking needed to cancel/delete the right event.
ALTER TABLE "companies" ADD COLUMN "google_calendar_id" TEXT;
ALTER TABLE "companies" ADD COLUMN "google_calendar_refresh_token_encrypted" TEXT;
ALTER TABLE "companies" ADD COLUMN "google_calendar_connected_email" TEXT;
ALTER TABLE "companies" ADD COLUMN "google_calendar_connected_at" TIMESTAMPTZ(6);

ALTER TABLE "bookings" ADD COLUMN "google_calendar_event_id" TEXT;
