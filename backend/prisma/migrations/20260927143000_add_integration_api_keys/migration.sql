ALTER TABLE "Deal"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "source" TEXT;

CREATE UNIQUE INDEX "Deal_userId_externalId_key"
  ON "Deal"("userId", "externalId");

CREATE TABLE "integration_api_keys" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scopes" TEXT NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_api_keys_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "integration_api_keys_keyHash_key"
  ON "integration_api_keys"("keyHash");

CREATE INDEX "integration_api_keys_userId_active_idx"
  ON "integration_api_keys"("userId", "active");
