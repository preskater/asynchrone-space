-- CreateTable
CREATE TABLE "workLocationDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workLocationDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeOffRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'vacation',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeOffBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allowanceDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeOffBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultAllowanceDays" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "weeklyHourTarget" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workLocationDay_organizationId_date_idx" ON "workLocationDay"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "workLocationDay_organizationId_userId_date_key" ON "workLocationDay"("organizationId", "userId", "date");

-- CreateIndex
CREATE INDEX "timeOffRequest_organizationId_status_idx" ON "timeOffRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "timeOffRequest_organizationId_userId_idx" ON "timeOffRequest"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "timeOffBalance_organizationId_userId_year_key" ON "timeOffBalance"("organizationId", "userId", "year");

-- CreateIndex
CREATE INDEX "timeEntry_organizationId_date_idx" ON "timeEntry"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "timeEntry_organizationId_userId_date_key" ON "timeEntry"("organizationId", "userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "hrSettings_organizationId_key" ON "hrSettings"("organizationId");

-- AddForeignKey
ALTER TABLE "workLocationDay" ADD CONSTRAINT "workLocationDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeOffRequest" ADD CONSTRAINT "timeOffRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeOffBalance" ADD CONSTRAINT "timeOffBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeEntry" ADD CONSTRAINT "timeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrSettings" ADD CONSTRAINT "hrSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
