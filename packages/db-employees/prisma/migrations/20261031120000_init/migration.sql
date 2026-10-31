-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
CREATE TABLE "hrSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultWeeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "defaultAllowanceDays" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "lowBalanceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "pendingValidationDays" INTEGER NOT NULL DEFAULT 3,
    "defaultEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 22,
    "defaultEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 42,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salaryProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salaryType" TEXT NOT NULL DEFAULT 'full_time',
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeRate" DOUBLE PRECISION NOT NULL DEFAULT 22,
    "employerRate" DOUBLE PRECISION NOT NULL DEFAULT 42,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salaryProfile_pkey" PRIMARY KEY ("id")
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
    "actorName" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
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
CREATE UNIQUE INDEX "hrSettings_organizationId_key" ON "hrSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "salaryProfile_organizationId_userId_key" ON "salaryProfile"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "internalActivity_organizationId_name_key" ON "internalActivity"("organizationId", "name");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_createdAt_idx" ON "auditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_action_createdAt_idx" ON "auditLog"("organizationId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_entityType_createdAt_idx" ON "auditLog"("organizationId", "entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "attendanceEntry" ADD CONSTRAINT "attendanceEntry_internalActivityId_fkey" FOREIGN KEY ("internalActivityId") REFERENCES "internalActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceEntry" ADD CONSTRAINT "attendanceEntry_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "leaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

