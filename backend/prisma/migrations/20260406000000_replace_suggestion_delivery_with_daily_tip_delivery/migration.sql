DROP TABLE IF EXISTS "SuggestionDelivery";

CREATE TABLE "daily_tip_delivery" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "delivery_date" TEXT NOT NULL,
    "workspace_mode" TEXT NOT NULL,
    "audience_bucket" TEXT NOT NULL,
    "tip_id" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_tip_delivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_tip_delivery_userId_delivery_date_key" ON "daily_tip_delivery"("userId", "delivery_date");
CREATE INDEX "daily_tip_delivery_delivery_date_idx" ON "daily_tip_delivery"("delivery_date");

ALTER TABLE "daily_tip_delivery"
ADD CONSTRAINT "daily_tip_delivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
