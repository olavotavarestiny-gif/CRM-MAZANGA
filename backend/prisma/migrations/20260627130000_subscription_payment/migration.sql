-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "plan" TEXT NOT NULL,
    "workspaceMode" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "method" TEXT NOT NULL,
    "merchantTransactionId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gatewayCode" TEXT,
    "gatewayMessage" TEXT,
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_merchantTransactionId_key" ON "SubscriptionPayment"("merchantTransactionId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_userId_idx" ON "SubscriptionPayment"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
