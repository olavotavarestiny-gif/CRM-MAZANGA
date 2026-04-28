CREATE TABLE "service_dashboard_settings" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "monthlyRevenueGoalKz" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_dashboard_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_dashboard_settings_userId_key" ON "service_dashboard_settings"("userId");

ALTER TABLE "service_dashboard_settings" ADD CONSTRAINT "service_dashboard_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
