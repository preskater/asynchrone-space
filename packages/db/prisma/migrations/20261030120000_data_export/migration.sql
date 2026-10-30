-- CreateTable
CREATE TABLE "dataExport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "oid" BIGINT,
    "sizeBytes" BIGINT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "dataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dataExport_organizationId_createdAt_idx" ON "dataExport"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "dataExport_status_idx" ON "dataExport"("status");

-- AddForeignKey
ALTER TABLE "dataExport" ADD CONSTRAINT "dataExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

