-- CreateTable
CREATE TABLE "taskTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "labelIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taskTemplate_organizationId_idx" ON "taskTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "taskTemplate_projectId_idx" ON "taskTemplate"("projectId");

-- AddForeignKey
ALTER TABLE "taskTemplate" ADD CONSTRAINT "taskTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskTemplate" ADD CONSTRAINT "taskTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
