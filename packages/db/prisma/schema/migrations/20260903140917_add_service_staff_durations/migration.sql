/*
  Warnings:

  - Made the column `created_at` on table `audit_log` required. This step will fail if there are existing NULL values in that column.
  - Made the column `config` on table `companies` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sla_config` on table `companies` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `companies` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `companies` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `notified` on table `health_incidents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `health_status` required. This step will fail if there are existing NULL values in that column.
  - Made the column `content_type` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_internal` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `active` on table `response_templates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `response_templates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `tickets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `tickets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `tickets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_company_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_company_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_service_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_ticket_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_company_id_fkey";

-- DropForeignKey
ALTER TABLE "faqs" DROP CONSTRAINT "faqs_company_id_fkey";

-- DropForeignKey
ALTER TABLE "faqs" DROP CONSTRAINT "faqs_created_by_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_ticket_id_fkey";

-- DropForeignKey
ALTER TABLE "response_templates" DROP CONSTRAINT "response_templates_company_id_fkey";

-- DropForeignKey
ALTER TABLE "response_templates" DROP CONSTRAINT "response_templates_created_by_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_company_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_created_by_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_absences" DROP CONSTRAINT "staff_absences_company_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_absences" DROP CONSTRAINT "staff_absences_service_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_assigned_to_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_company_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_company_id_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_routes" DROP CONSTRAINT "whatsapp_routes_company_id_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_routes" DROP CONSTRAINT "whatsapp_routes_customer_id_fkey";

-- DropIndex
DROP INDEX "idx_whatsapp_routes_company";

-- DropIndex
DROP INDEX "idx_whatsapp_routes_customer";

-- AlterTable
ALTER TABLE "audit_log" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "config" SET NOT NULL,
ALTER COLUMN "sla_config" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "health_incidents" ALTER COLUMN "notified" SET NOT NULL;

-- AlterTable
ALTER TABLE "health_status" ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "content_type" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "is_internal" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "response_templates" ALTER COLUMN "active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "staff_durations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "whatsapp_routes" ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_routes" ADD CONSTRAINT "whatsapp_routes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_routes" ADD CONSTRAINT "whatsapp_routes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_accounts_user" RENAME TO "accounts_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_audit_company" RENAME TO "audit_log_company_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_bookings_company" RENAME TO "bookings_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_bookings_service_scheduled" RENAME TO "bookings_service_id_scheduled_at_idx";

-- RenameIndex
ALTER INDEX "idx_customers_company" RENAME TO "customers_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_customers_phone" RENAME TO "customers_company_id_phone_idx";

-- RenameIndex
ALTER INDEX "idx_faqs_company" RENAME TO "faqs_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_messages_company" RENAME TO "messages_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_messages_ticket" RENAME TO "messages_ticket_id_idx";

-- RenameIndex
ALTER INDEX "idx_templates_company" RENAME TO "response_templates_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_services_company" RENAME TO "services_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_sessions_user" RENAME TO "sessions_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_staff_absences_company" RENAME TO "staff_absences_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_tickets_company" RENAME TO "tickets_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_tickets_status" RENAME TO "tickets_company_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_users_company" RENAME TO "users_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_verifications_identifier" RENAME TO "verifications_identifier_idx";
