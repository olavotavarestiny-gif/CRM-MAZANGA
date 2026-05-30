-- AlterTable: add userId to FinancialCategory for per-user category management
ALTER TABLE "FinancialCategory" ADD COLUMN "userId" INTEGER;

-- Drop old unique constraint (type, category) and replace with (userId, type, category)
ALTER TABLE "FinancialCategory" DROP CONSTRAINT IF EXISTS "FinancialCategory_type_category_key";
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_userId_type_category_key" UNIQUE ("userId", "type", "category");

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
