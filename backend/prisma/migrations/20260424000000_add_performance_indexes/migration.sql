-- Contact: indexes for common filter/sort patterns
CREATE INDEX IF NOT EXISTS "Contact_userId_idx" ON "Contact"("userId");
CREATE INDEX IF NOT EXISTS "Contact_userId_createdAt_idx" ON "Contact"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Contact_userId_inPipeline_idx" ON "Contact"("userId", "inPipeline");
CREATE INDEX IF NOT EXISTS "Contact_userId_stage_idx" ON "Contact"("userId", "stage");

-- Task: indexes for sort by dueDate and lookup by contactId
CREATE INDEX IF NOT EXISTS "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");
CREATE INDEX IF NOT EXISTS "Task_contactId_idx" ON "Task"("contactId");

-- Message: index for loading messages per contact
CREATE INDEX IF NOT EXISTS "Message_contactId_idx" ON "Message"("contactId");
