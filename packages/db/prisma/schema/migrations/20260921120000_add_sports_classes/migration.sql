-- Sports-court modality (see sports.prisma): purely additive — new tables
-- only, no existing table is altered. Generated with `prisma migrate diff`,
-- plus the two partial unique indexes Prisma can't express (same technique
-- as idx_bookings_no_double_book).

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_classes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "sport" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "instructor_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sport_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_session_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'cancelled',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_session_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "price_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_sport_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "sport" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_sport_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "customer_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "participants" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'group_play',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courts_company_id_idx" ON "courts"("company_id");

-- CreateIndex
CREATE INDEX "sport_classes_company_id_idx" ON "sport_classes"("company_id");

-- CreateIndex
CREATE INDEX "sport_classes_court_id_weekday_start_time_idx" ON "sport_classes"("court_id", "weekday", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "class_session_overrides_class_id_date_key" ON "class_session_overrides"("class_id", "date");

-- CreateIndex
CREATE INDEX "class_enrollments_company_id_idx" ON "class_enrollments"("company_id");

-- CreateIndex
CREATE INDEX "class_enrollments_class_id_date_idx" ON "class_enrollments"("class_id", "date");

-- CreateIndex
CREATE INDEX "class_enrollments_customer_id_idx" ON "class_enrollments"("customer_id");

-- CreateIndex
CREATE INDEX "customer_sport_levels_company_id_idx" ON "customer_sport_levels"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_sport_levels_customer_id_sport_key" ON "customer_sport_levels"("customer_id", "sport");

-- CreateIndex
CREATE INDEX "court_reservations_company_id_idx" ON "court_reservations"("company_id");

-- CreateIndex
CREATE INDEX "court_reservations_court_id_starts_at_idx" ON "court_reservations"("court_id", "starts_at");

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_classes" ADD CONSTRAINT "sport_classes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_classes" ADD CONSTRAINT "sport_classes_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_session_overrides" ADD CONSTRAINT "class_session_overrides_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "sport_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "sport_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_sport_levels" ADD CONSTRAINT "customer_sport_levels_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_sport_levels" ADD CONSTRAINT "customer_sport_levels_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_reservations" ADD CONSTRAINT "court_reservations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_reservations" ADD CONSTRAINT "court_reservations_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_reservations" ADD CONSTRAINT "court_reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One confirmed enrollment per (class, date, customer) — seat CAPACITY is
-- enforced in lib/sports/classes.ts#enrollInClass (row lock + count), this
-- only stops the same person taking two seats in the same session.
CREATE UNIQUE INDEX "idx_class_enrollments_unique_confirmed"
  ON "class_enrollments" ("class_id", "date", "customer_id")
  WHERE "status" = 'confirmed';

-- Backstop against two confirmed reservations starting at the same instant
-- on one court; the real overlap check (against classes AND other
-- reservations, any duration) lives in lib/sports/courts.ts.
CREATE UNIQUE INDEX "idx_court_reservations_no_double"
  ON "court_reservations" ("court_id", "starts_at")
  WHERE "status" = 'confirmed';
