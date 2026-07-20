ALTER TABLE companies ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE companies ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE companies ADD COLUMN subscription_status TEXT;
ALTER TABLE companies ADD COLUMN trial_ends_at TIMESTAMPTZ;
