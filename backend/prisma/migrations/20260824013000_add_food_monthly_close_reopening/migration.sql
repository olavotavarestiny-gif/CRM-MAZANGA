ALTER TABLE "food_monthly_closes"
  ADD COLUMN "reopenedByUserId" INTEGER,
  ADD COLUMN "reopenedAt" TIMESTAMP(3),
  ADD COLUMN "reopenReason" TEXT;
