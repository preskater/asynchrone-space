/*
  Warnings:

  - You are about to drop the column `weeklyHourTarget` on the `hrSettings` table. All the data in the column will be lost.
  - You are about to drop the `timeEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `timeOffBalance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `timeOffRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workLocationDay` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "timeEntry" DROP CONSTRAINT "timeEntry_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "timeOffBalance" DROP CONSTRAINT "timeOffBalance_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "timeOffRequest" DROP CONSTRAINT "timeOffRequest_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "workLocationDay" DROP CONSTRAINT "workLocationDay_organizationId_fkey";

-- AlterTable
ALTER TABLE "hrSettings" DROP COLUMN "weeklyHourTarget",
ADD COLUMN     "defaultWeeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 35,
ADD COLUMN     "lowBalanceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "pendingValidationDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "isBillable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "plannedHours" DOUBLE PRECISION,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- DropTable
DROP TABLE "timeEntry";

-- DropTable
DROP TABLE "timeOffBalance";

-- DropTable
DROP TABLE "timeOffRequest";

-- CreateTable
CREATE TABLE "hrProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'employee',
    "contractType" TEXT NOT NULL DEFAULT 'cdi',
    "weeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "managerId" TEXT,
    "isValidator" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendanceEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "projectId" TEXT,
    "internalActivityId" TEXT,
    "leaveRequestId" TEXT,
    "isBillable" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaveRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startPeriod" TEXT NOT NULL DEFAULT 'morning',
    "endPeriod" TEXT NOT NULL DEFAULT 'afternoon',
    "halfDays" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "validatorId" TEXT,
    "decisionDate" TIMESTAMP(3),
    "decisionComment" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaveBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allowanceDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaveAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaveAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internalActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'internal',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrProfile_organizationId_userId_key" ON "hrProfile"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "attendanceEntry_organizationId_date_idx" ON "attendanceEntry"("organizationId", "date");

-- CreateIndex
CREATE INDEX "attendanceEntry_userId_date_idx" ON "attendanceEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "attendanceEntry_projectId_idx" ON "attendanceEntry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "attendanceEntry_organizationId_userId_date_period_key" ON "attendanceEntry"("organizationId", "userId", "date", "period");

-- CreateIndex
CREATE INDEX "leaveRequest_organizationId_status_idx" ON "leaveRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "leaveRequest_organizationId_userId_idx" ON "leaveRequest"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "leaveBalance_organizationId_userId_leaveType_year_key" ON "leaveBalance"("organizationId", "userId", "leaveType", "year");

-- CreateIndex
CREATE INDEX "leaveAdjustment_organizationId_userId_year_idx" ON "leaveAdjustment"("organizationId", "userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "client_organizationId_name_key" ON "client"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "internalActivity_organizationId_name_key" ON "internalActivity"("organizationId", "name");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_createdAt_idx" ON "auditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "project_clientId_idx" ON "project"("clientId");

-- Data migration: carry over declared work locations (full days, office/remote)
-- as morning + afternoon attendance entries (on_site/remote half-days).
INSERT INTO "attendanceEntry" (
  "id", "organizationId", "userId", "date", "period", "status", "location",
  "isBillable", "comment", "createdBy", "updatedBy", "createdAt", "updatedAt"
)
SELECT
  'legacy_wl_' || "id" || '_m',
  "organizationId", "userId", "date", 'morning',
  CASE WHEN "status" = 'office' THEN 'on_site' ELSE 'remote' END,
  CASE WHEN "status" = 'office' THEN 'on_site' ELSE 'remote' END,
  false, "note", "userId", "userId", "createdAt", "updatedAt"
FROM "workLocationDay"
UNION ALL
SELECT
  'legacy_wl_' || "id" || '_a',
  "organizationId", "userId", "date", 'afternoon',
  CASE WHEN "status" = 'office' THEN 'on_site' ELSE 'remote' END,
  CASE WHEN "status" = 'office' THEN 'on_site' ELSE 'remote' END,
  false, "note", "userId", "userId", "createdAt", "updatedAt"
FROM "workLocationDay";

-- DropTable (after the data migration above)
DROP TABLE "workLocationDay";

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrProfile" ADD CONSTRAINT "hrProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceEntry" ADD CONSTRAINT "attendanceEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceEntry" ADD CONSTRAINT "attendanceEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceEntry" ADD CONSTRAINT "attendanceEntry_internalActivityId_fkey" FOREIGN KEY ("internalActivityId") REFERENCES "internalActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceEntry" ADD CONSTRAINT "attendanceEntry_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "leaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaveRequest" ADD CONSTRAINT "leaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaveBalance" ADD CONSTRAINT "leaveBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaveAdjustment" ADD CONSTRAINT "leaveAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internalActivity" ADD CONSTRAINT "internalActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
