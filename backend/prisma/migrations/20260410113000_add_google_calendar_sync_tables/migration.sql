CREATE TABLE IF NOT EXISTS "GoogleCalendarToken" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "status" TEXT NOT NULL DEFAULT 'connected',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "googleEmail" TEXT,
    "primaryCalendarId" TEXT NOT NULL DEFAULT 'primary',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarToken_userId_key" ON "GoogleCalendarToken"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'GoogleCalendarToken_userId_fkey'
    ) THEN
        ALTER TABLE "GoogleCalendarToken"
        ADD CONSTRAINT "GoogleCalendarToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "GoogleCalendarToken" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'google';
ALTER TABLE "GoogleCalendarToken" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'connected';
ALTER TABLE "GoogleCalendarToken" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "GoogleCalendarToken" ADD COLUMN IF NOT EXISTS "primaryCalendarId" TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE "GoogleCalendarToken" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "GoogleCalendarToken" ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT;
ALTER TABLE "GoogleCalendarToken" ADD COLUMN IF NOT EXISTS "lastSyncErrorAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "GoogleCalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "googleEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "htmlLink" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GoogleCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarEvent_userId_calendarId_googleEventId_key"
ON "GoogleCalendarEvent"("userId", "calendarId", "googleEventId");

CREATE INDEX IF NOT EXISTS "GoogleCalendarEvent_userId_startAt_idx" ON "GoogleCalendarEvent"("userId", "startAt");
CREATE INDEX IF NOT EXISTS "GoogleCalendarEvent_userId_endAt_idx" ON "GoogleCalendarEvent"("userId", "endAt");
CREATE INDEX IF NOT EXISTS "GoogleCalendarEvent_userId_status_idx" ON "GoogleCalendarEvent"("userId", "status");
