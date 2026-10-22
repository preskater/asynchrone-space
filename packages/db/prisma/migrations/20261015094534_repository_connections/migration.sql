-- AlterTable
ALTER TABLE "task" ADD COLUMN     "externalIssueNumber" INTEGER,
ADD COLUMN     "externalIssueUrl" TEXT,
ADD COLUMN     "externalPrNumber" INTEGER,
ADD COLUMN     "externalPrUrl" TEXT,
ADD COLUMN     "externalUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "repositoryConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repositoryConnection_projectId_key" ON "repositoryConnection"("projectId");

-- CreateIndex
CREATE INDEX "repositoryConnection_organizationId_idx" ON "repositoryConnection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "repositoryConnection_organizationId_provider_owner_repo_key" ON "repositoryConnection"("organizationId", "provider", "owner", "repo");

-- AddForeignKey
ALTER TABLE "repositoryConnection" ADD CONSTRAINT "repositoryConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositoryConnection" ADD CONSTRAINT "repositoryConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
