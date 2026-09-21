-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "reminder_day_sent_at" TIMESTAMPTZ(6);
ALTER TABLE "bookings" ADD COLUMN "reminder_hour_sent_at" TIMESTAMPTZ(6);
