-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "fileNode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "parentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "modifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sizeBytes" INTEGER,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "trashed" BOOLEAN NOT NULL DEFAULT false,
    "trashedAt" TIMESTAMP(3),
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "oid" BIGINT,
    "mimeType" TEXT,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fileNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploadSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "mimeType" TEXT,
    "oid" BIGINT NOT NULL,
    "expectedSize" INTEGER,
    "receivedBytes" INTEGER NOT NULL DEFAULT 0,
    "sha256" TEXT,
    "transient" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fileShare" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'view',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fileShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fileVersion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL,
    "oid" BIGINT,
    "mimeType" TEXT,
    "sha256" TEXT,
    "sizeBytes" INTEGER,

    CONSTRAINT "fileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fileActivity" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fileActivity_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "fileNode_oid_key" ON "fileNode"("oid");

-- CreateIndex
CREATE INDEX "fileNode_organizationId_parentId_idx" ON "fileNode"("organizationId", "parentId");

-- CreateIndex
CREATE INDEX "fileNode_ownerId_idx" ON "fileNode"("ownerId");

-- CreateIndex
CREATE INDEX "uploadSession_organizationId_status_idx" ON "uploadSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "uploadSession_expiresAt_idx" ON "uploadSession"("expiresAt");

-- CreateIndex
CREATE INDEX "fileShare_userId_idx" ON "fileShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fileShare_fileId_userId_key" ON "fileShare"("fileId", "userId");

-- CreateIndex
CREATE INDEX "fileVersion_fileId_idx" ON "fileVersion"("fileId");

-- CreateIndex
CREATE INDEX "fileActivity_fileId_idx" ON "fileActivity"("fileId");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_createdAt_idx" ON "auditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_action_createdAt_idx" ON "auditLog"("organizationId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_entityType_createdAt_idx" ON "auditLog"("organizationId", "entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "fileNode" ADD CONSTRAINT "fileNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileShare" ADD CONSTRAINT "fileShare_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileVersion" ADD CONSTRAINT "fileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileActivity" ADD CONSTRAINT "fileActivity_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

