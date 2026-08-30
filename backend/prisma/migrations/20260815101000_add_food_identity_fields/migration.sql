-- KukuGest Food identity fields.

ALTER TABLE "food_settings"
  ADD COLUMN IF NOT EXISTS "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
  ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT,
  ADD COLUMN IF NOT EXISTS "restaurantPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "restaurantEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "restaurantAddress" TEXT;
