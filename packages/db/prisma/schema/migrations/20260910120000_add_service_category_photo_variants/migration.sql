-- AlterTable
ALTER TABLE "services" ADD COLUMN "category" TEXT;
ALTER TABLE "services" ADD COLUMN "photo_url" TEXT;
ALTER TABLE "services" ADD COLUMN "variants" JSONB NOT NULL DEFAULT '[]';
