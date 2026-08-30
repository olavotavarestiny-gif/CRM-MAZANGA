CREATE TABLE "food_birthday_automation_settings" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "daysBefore" INTEGER NOT NULL DEFAULT 0,
  "sendTime" TEXT NOT NULL DEFAULT '09:00',
  "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "template" TEXT NOT NULL DEFAULT 'Feliz aniversário, {{nome}}!',
  "benefitType" TEXT NOT NULL DEFAULT 'none',
  "couponId" TEXT,
  "validityDays" INTEGER NOT NULL DEFAULT 7,
  "minimumOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "segmentId" TEXT,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_birthday_automation_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_birthday_automation_settings_organizationId_key"
  ON "food_birthday_automation_settings"("organizationId");
CREATE INDEX "food_birthday_automation_settings_organizationId_enabled_idx"
  ON "food_birthday_automation_settings"("organizationId", "enabled");
CREATE INDEX "food_birthday_automation_settings_couponId_idx"
  ON "food_birthday_automation_settings"("couponId");
CREATE INDEX "food_birthday_automation_settings_segmentId_idx"
  ON "food_birthday_automation_settings"("segmentId");

ALTER TABLE "food_birthday_automation_settings"
  ADD CONSTRAINT "food_birthday_automation_settings_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "food_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_birthday_automation_settings"
  ADD CONSTRAINT "food_birthday_automation_settings_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "food_customer_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
