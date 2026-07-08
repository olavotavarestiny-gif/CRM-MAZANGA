-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "conditionFieldId" TEXT,
ADD COLUMN "conditionValue" TEXT;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_conditionFieldId_fkey" FOREIGN KEY ("conditionFieldId") REFERENCES "FormField"("id") ON DELETE SET NULL ON UPDATE CASCADE;
