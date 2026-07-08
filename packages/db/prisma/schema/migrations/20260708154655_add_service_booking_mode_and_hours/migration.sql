ALTER TABLE services ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE services ADD COLUMN business_hours JSONB;
