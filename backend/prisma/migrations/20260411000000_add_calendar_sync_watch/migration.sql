CREATE TABLE IF NOT EXISTS "CalendarSync" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "channelToken" TEXT NOT NULL,
    "syncToken" TEXT,
    "watchExpiry" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSync_userId_key" ON "CalendarSync"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSync_channelId_key" ON "CalendarSync"("channelId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSync_userId_fkey'
    ) THEN
        ALTER TABLE "CalendarSync"
            ADD CONSTRAINT "CalendarSync_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
