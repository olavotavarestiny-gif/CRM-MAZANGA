ALTER TABLE "food_birthday_automation_settings"
  ADD CONSTRAINT "food_birthday_automation_settings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
