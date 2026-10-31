-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "clientId" TEXT,
    "clientVisible" BOOLEAN NOT NULL DEFAULT true,
    "clientDiscussion" TEXT NOT NULL DEFAULT 'read_write',
    "clientTaskComments" TEXT NOT NULL DEFAULT 'read_write',
    "plannedHours" DOUBLE PRECISION,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectLabel" (
    "projectId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "projectLabel_pkey" PRIMARY KEY ("projectId","labelId")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "templateId" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createIssue" BOOLEAN NOT NULL DEFAULT true,
    "externalIssueNumber" INTEGER,
    "externalIssueUrl" TEXT,
    "externalPrNumber" INTEGER,
    "externalPrUrl" TEXT,
    "externalUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_identifier_counter" (
    "organizationId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "task_identifier_counter_pkey" PRIMARY KEY ("organizationId","prefix")
);

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
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taskLabel" (
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "taskLabel_pkey" PRIMARY KEY ("taskId","labelId")
);

-- CreateTable
CREATE TABLE "subtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorKind" TEXT NOT NULL DEFAULT 'internal',
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectActivity_pkey" PRIMARY KEY ("id")
);

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
    "webhookSecret" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userRepositoryToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "userRepositoryToken_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "project_organizationId_idx" ON "project"("organizationId");

-- CreateIndex
CREATE INDEX "project_clientId_idx" ON "project"("clientId");

-- CreateIndex
CREATE INDEX "projectMember_userId_idx" ON "projectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "projectMember_projectId_userId_key" ON "projectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "label_organizationId_name_key" ON "label"("organizationId", "name");

-- CreateIndex
CREATE INDEX "task_organizationId_idx" ON "task"("organizationId");

-- CreateIndex
CREATE INDEX "task_projectId_idx" ON "task"("projectId");

-- CreateIndex
CREATE INDEX "task_assigneeId_idx" ON "task"("assigneeId");

-- CreateIndex
CREATE INDEX "task_templateId_idx" ON "task"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "task_organizationId_identifier_key" ON "task"("organizationId", "identifier");

-- CreateIndex
CREATE INDEX "taskTemplate_organizationId_idx" ON "taskTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "taskTemplate_projectId_idx" ON "taskTemplate"("projectId");

-- CreateIndex
CREATE INDEX "subtask_taskId_idx" ON "subtask"("taskId");

-- CreateIndex
CREATE INDEX "taskComment_taskId_idx" ON "taskComment"("taskId");

-- CreateIndex
CREATE INDEX "projectActivity_projectId_idx" ON "projectActivity"("projectId");

-- CreateIndex
CREATE INDEX "projectMessage_organizationId_idx" ON "projectMessage"("organizationId");

-- CreateIndex
CREATE INDEX "projectMessage_projectId_createdAt_idx" ON "projectMessage"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "repositoryConnection_projectId_key" ON "repositoryConnection"("projectId");

-- CreateIndex
CREATE INDEX "repositoryConnection_organizationId_idx" ON "repositoryConnection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "repositoryConnection_organizationId_provider_owner_repo_key" ON "repositoryConnection"("organizationId", "provider", "owner", "repo");

-- CreateIndex
CREATE INDEX "userRepositoryToken_userId_idx" ON "userRepositoryToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "userRepositoryToken_userId_provider_key" ON "userRepositoryToken"("userId", "provider");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_createdAt_idx" ON "auditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_action_createdAt_idx" ON "auditLog"("organizationId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "auditLog_organizationId_entityType_createdAt_idx" ON "auditLog"("organizationId", "entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "projectMember" ADD CONSTRAINT "projectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectLabel" ADD CONSTRAINT "projectLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectLabel" ADD CONSTRAINT "projectLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "taskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskTemplate" ADD CONSTRAINT "taskTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskLabel" ADD CONSTRAINT "taskLabel_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskLabel" ADD CONSTRAINT "taskLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask" ADD CONSTRAINT "subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskComment" ADD CONSTRAINT "taskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectActivity" ADD CONSTRAINT "projectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectMessage" ADD CONSTRAINT "projectMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositoryConnection" ADD CONSTRAINT "repositoryConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

