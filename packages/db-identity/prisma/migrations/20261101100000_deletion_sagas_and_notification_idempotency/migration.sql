-- Cross-database export/deletion saga state and idempotent notifications.

CREATE TABLE "platformHandoff" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'impersonate',
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platformHandoff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platformHandoff_tokenHash_key" ON "platformHandoff"("tokenHash");
CREATE INDEX "platformHandoff_expiresAt_idx" ON "platformHandoff"("expiresAt");
CREATE INDEX "platformHandoff_targetUserId_idx" ON "platformHandoff"("targetUserId");

ALTER TABLE "notification" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "notification_organizationId_idempotencyKey_key" ON "notification"("organizationId", "idempotencyKey");

CREATE TABLE "dataExportApp" (
    "id" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "schemaVersion" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT,
    "oid" BIGINT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "dataExportApp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dataExportApp_exportId_app_key" ON "dataExportApp"("exportId", "app");
CREATE INDEX "dataExportApp_status_idx" ON "dataExportApp"("status");
ALTER TABLE "dataExportApp" ADD CONSTRAINT "dataExportApp_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "dataExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "organizationDeletionJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentApp" TEXT,
    "requestedById" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizationDeletionJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizationDeletionJob_organizationId_key" ON "organizationDeletionJob"("organizationId");
CREATE INDEX "organizationDeletionJob_status_scheduledAt_idx" ON "organizationDeletionJob"("status", "scheduledAt");

CREATE TABLE "organizationDeletionApp" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "organizationDeletionApp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizationDeletionApp_jobId_app_key" ON "organizationDeletionApp"("jobId", "app");
CREATE INDEX "organizationDeletionApp_status_idx" ON "organizationDeletionApp"("status");
ALTER TABLE "organizationDeletionApp" ADD CONSTRAINT "organizationDeletionApp_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "organizationDeletionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "userDeletionJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentApp" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "userDeletionJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "userDeletionJob_userId_key" ON "userDeletionJob"("userId");
CREATE INDEX "userDeletionJob_status_scheduledAt_idx" ON "userDeletionJob"("status", "scheduledAt");

CREATE TABLE "userDeletionApp" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "userDeletionApp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "userDeletionApp_jobId_app_key" ON "userDeletionApp"("jobId", "app");
CREATE INDEX "userDeletionApp_status_idx" ON "userDeletionApp"("status");
ALTER TABLE "userDeletionApp" ADD CONSTRAINT "userDeletionApp_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "userDeletionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
