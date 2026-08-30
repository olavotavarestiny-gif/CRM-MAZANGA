ALTER TABLE "food_settings"
  ADD COLUMN "kitchenSoundVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  ADD COLUMN "kitchenSoundRepeatSeconds" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "kdsUnacceptedWarningSeconds" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "kdsUnacceptedEscalationSeconds" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "kdsReadyReminderMinutes" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "food_kitchen_tickets"
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgedByUserId" INTEGER;

CREATE INDEX "food_kitchen_tickets_userId_state_acknowledgedAt_createdAt_idx"
  ON "food_kitchen_tickets"("userId", "state", "acknowledgedAt", "createdAt");
