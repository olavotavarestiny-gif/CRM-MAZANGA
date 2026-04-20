ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT,
    ADD COLUMN IF NOT EXISTS "googleCalendarHtmlLink" TEXT,
    ADD COLUMN IF NOT EXISTS "googleCalendarSyncedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "googleCalendarSyncError" TEXT;
