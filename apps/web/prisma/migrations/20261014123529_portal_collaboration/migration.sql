-- AlterTable
ALTER TABLE "member" ADD COLUMN     "portalLastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "projectMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorKind" TEXT NOT NULL DEFAULT 'internal',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projectMessage_organizationId_idx" ON "projectMessage"("organizationId");

-- CreateIndex
CREATE INDEX "projectMessage_projectId_createdAt_idx" ON "projectMessage"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "projectMessage" ADD CONSTRAINT "projectMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectMessage" ADD CONSTRAINT "projectMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
