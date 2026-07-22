ALTER TABLE companies
  ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
