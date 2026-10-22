-- AlterTable
ALTER TABLE "calendarEvent" ADD COLUMN     "meetingPassword" TEXT;

-- CreateTable
CREATE TABLE "meetingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientRequestsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoDeclineOverlaps" BOOLEAN NOT NULL DEFAULT true,
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetingRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'online',
    "meetingUrl" TEXT,
    "meetingPassword" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "calendarEventId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "externalMeetingId" TEXT,
    "externalJoinUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meetingSettings_organizationId_key" ON "meetingSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "meetingRequest_calendarEventId_key" ON "meetingRequest"("calendarEventId");

-- CreateIndex
CREATE INDEX "meetingRequest_organizationId_status_idx" ON "meetingRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "meetingRequest_clientId_idx" ON "meetingRequest"("clientId");

-- CreateIndex
CREATE INDEX "meetingRequest_startAt_idx" ON "meetingRequest"("startAt");

-- AddForeignKey
ALTER TABLE "meetingSettings" ADD CONSTRAINT "meetingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetingRequest" ADD CONSTRAINT "meetingRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetingRequest" ADD CONSTRAINT "meetingRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetingRequest" ADD CONSTRAINT "meetingRequest_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
