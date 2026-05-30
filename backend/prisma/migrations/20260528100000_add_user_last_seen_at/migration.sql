ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_lastSeenAt_idx" ON "User"("lastSeenAt");
