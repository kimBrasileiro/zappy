-- Optional contact phone, collected at signup alongside email/password.
-- Nullable and never backfilled -- existing users simply have no phone on
-- file until they're asked for it some other way.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
