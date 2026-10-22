-- CreateTable
CREATE TABLE "crmDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crmDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crmDocument_organizationId_entity_entityId_idx" ON "crmDocument"("organizationId", "entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "crmDocument_fileId_entity_entityId_key" ON "crmDocument"("fileId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "notification_organizationId_userId_createdAt_idx" ON "notification"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "crmDocument" ADD CONSTRAINT "crmDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmDocument" ADD CONSTRAINT "crmDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
