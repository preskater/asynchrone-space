-- Rename the employees tables in the dedicated database (#147, ADR 0030).
ALTER TABLE "hrProfile" RENAME TO "employeeProfile";
ALTER TABLE "hrSettings" RENAME TO "employeeSettings";

ALTER TABLE "employeeProfile" RENAME CONSTRAINT "hrProfile_pkey" TO "employeeProfile_pkey";

ALTER TABLE "employeeSettings" RENAME CONSTRAINT "hrSettings_pkey" TO "employeeSettings_pkey";

ALTER INDEX "hrProfile_organizationId_userId_key" RENAME TO "employeeProfile_organizationId_userId_key";
ALTER INDEX "hrSettings_organizationId_key" RENAME TO "employeeSettings_organizationId_key";
