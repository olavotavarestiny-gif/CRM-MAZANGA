-- CreateTable
CREATE TABLE "AccountMembership" (
    "id" TEXT NOT NULL,
    "personId" INTEGER NOT NULL,
    "accountOwnerId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "permissions" TEXT,
    "assignedEstabelecimentoId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountMembership_personId_idx" ON "AccountMembership"("personId");

-- CreateIndex
CREATE INDEX "AccountMembership_accountOwnerId_idx" ON "AccountMembership"("accountOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMembership_personId_accountOwnerId_key" ON "AccountMembership"("personId", "accountOwnerId");

-- AddForeignKey
ALTER TABLE "AccountMembership" ADD CONSTRAINT "AccountMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMembership" ADD CONSTRAINT "AccountMembership_accountOwnerId_fkey" FOREIGN KEY ("accountOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
