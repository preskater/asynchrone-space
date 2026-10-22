-- CreateTable
CREATE TABLE "platformAuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "organizationId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platformAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE INDEX "platformAuditEvent_createdAt_idx" ON "platformAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "platformAuditEvent_actorId_createdAt_idx" ON "platformAuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "platformAuditEvent_targetType_targetId_idx" ON "platformAuditEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "platformAuditEvent_organizationId_idx" ON "platformAuditEvent"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "platformHandoff_tokenHash_key" ON "platformHandoff"("tokenHash");

-- CreateIndex
CREATE INDEX "platformHandoff_expiresAt_idx" ON "platformHandoff"("expiresAt");

-- CreateIndex
CREATE INDEX "platformHandoff_targetUserId_idx" ON "platformHandoff"("targetUserId");
