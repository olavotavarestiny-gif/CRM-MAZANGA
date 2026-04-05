-- CreateTable
CREATE TABLE "SuggestionDelivery" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "payload" TEXT,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionDelivery_userId_date_key" ON "SuggestionDelivery"("userId", "date");

-- AddForeignKey
ALTER TABLE "SuggestionDelivery" ADD CONSTRAINT "SuggestionDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
