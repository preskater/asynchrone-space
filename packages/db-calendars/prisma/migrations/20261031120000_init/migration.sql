-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "calendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "kind" TEXT NOT NULL DEFAULT 'personal',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendarMember" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "calendarMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "meetingUrl" TEXT,
    "meetingPassword" TEXT,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "reminderMinutes" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "eventAttendee_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "meetingSlot" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "selected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meetingSlot_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "calendar_organizationId_idx" ON "calendar"("organizationId");

-- CreateIndex
CREATE INDEX "calendarMember_userId_idx" ON "calendarMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendarMember_calendarId_userId_key" ON "calendarMember"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "calendarEvent_organizationId_idx" ON "calendarEvent"("organizationId");

-- CreateIndex
CREATE INDEX "calendarEvent_calendarId_idx" ON "calendarEvent"("calendarId");

-- CreateIndex
CREATE INDEX "calendarEvent_startAt_idx" ON "calendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "eventAttendee_userId_idx" ON "eventAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "eventAttendee_eventId_userId_key" ON "eventAttendee"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "meetingSettings_organizationId_key" ON "meetingSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "meetingRequest_calendarEventId_key" ON "meetingRequest"("calendarEventId");

-- CreateIndex
CREATE INDEX "meetingRequest_organizationId_status_idx" ON "meetingRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "meetingRequest_clientId_idx" ON "meetingRequest"("clientId");

-- CreateIndex
CREATE INDEX "meetingSlot_requestId_idx" ON "meetingSlot"("requestId");

-- CreateIndex
CREATE INDEX "meetingSlot_startAt_idx" ON "meetingSlot"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "meetingSlot_requestId_startAt_key" ON "meetingSlot"("requestId", "startAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_createdAt_idx" ON "auditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_action_createdAt_idx" ON "auditLog"("organizationId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_entityType_createdAt_idx" ON "auditLog"("organizationId", "entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "calendarMember" ADD CONSTRAINT "calendarMember_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarEvent" ADD CONSTRAINT "calendarEvent_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventAttendee" ADD CONSTRAINT "eventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetingRequest" ADD CONSTRAINT "meetingRequest_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetingSlot" ADD CONSTRAINT "meetingSlot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "meetingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

