-- Base improvements for forms, follow-up automations, local calendar events, and service dashboard.

ALTER TABLE "Contact"
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

UPDATE "Contact"
SET "lastActivityAt" = "updatedAt"
WHERE "lastActivityAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Contact_userId_lastActivityAt_idx" ON "Contact"("userId", "lastActivityAt");
CREATE INDEX IF NOT EXISTS "Contact_userId_birthDate_idx" ON "Contact"("userId", "birthDate");

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "automationId" TEXT;

CREATE INDEX IF NOT EXISTS "Task_userId_source_idx" ON "Task"("userId", "source");
CREATE INDEX IF NOT EXISTS "Task_automationId_idx" ON "Task"("automationId");

CREATE TABLE IF NOT EXISTS "automation_alert" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "contactId" INTEGER,
  "automationId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "automation_alert_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_alert_userId_fkey'
  ) THEN
    ALTER TABLE "automation_alert"
      ADD CONSTRAINT "automation_alert_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_alert_contactId_fkey'
  ) THEN
    ALTER TABLE "automation_alert"
      ADD CONSTRAINT "automation_alert_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_alert_automationId_fkey'
  ) THEN
    ALTER TABLE "automation_alert"
      ADD CONSTRAINT "automation_alert_automationId_fkey"
      FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "automation_alert_userId_status_createdAt_idx" ON "automation_alert"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "automation_alert_contactId_idx" ON "automation_alert"("contactId");
CREATE INDEX IF NOT EXISTS "automation_alert_automationId_idx" ON "automation_alert"("automationId");

CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "contactId" INTEGER,
  "assignedToUserId" INTEGER,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "syncWithGoogle" BOOLEAN NOT NULL DEFAULT false,
  "googleCalendarEventId" TEXT,
  "googleCalendarHtmlLink" TEXT,
  "googleCalendarSyncError" TEXT,
  "googleCalendarSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_userId_fkey'
  ) THEN
    ALTER TABLE "CalendarEvent"
      ADD CONSTRAINT "CalendarEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_contactId_fkey'
  ) THEN
    ALTER TABLE "CalendarEvent"
      ADD CONSTRAINT "CalendarEvent_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_assignedToUserId_fkey'
  ) THEN
    ALTER TABLE "CalendarEvent"
      ADD CONSTRAINT "CalendarEvent_assignedToUserId_fkey"
      FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CalendarEvent_assignedToUserId_startDate_idx" ON "CalendarEvent"("assignedToUserId", "startDate");
CREATE INDEX IF NOT EXISTS "CalendarEvent_contactId_idx" ON "CalendarEvent"("contactId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_userId_startDate_idx" ON "CalendarEvent"("userId", "startDate");
CREATE INDEX IF NOT EXISTS "CalendarEvent_googleCalendarEventId_idx" ON "CalendarEvent"("googleCalendarEventId");
