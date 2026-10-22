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
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fileNode_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "chatTeam" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'channel',
    "name" TEXT NOT NULL,
    "teamId" TEXT,
    "topic" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "conversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "meetingTitle" TEXT,
    "meetingStartsAt" TIMESTAMP(3),
    "meetingDuration" INTEGER,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "messageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "meta" TEXT,

    CONSTRAINT "messageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_organizationId_idx" ON "project"("organizationId");

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
CREATE UNIQUE INDEX "task_organizationId_identifier_key" ON "task"("organizationId", "identifier");

-- CreateIndex
CREATE INDEX "subtask_taskId_idx" ON "subtask"("taskId");

-- CreateIndex
CREATE INDEX "taskComment_taskId_idx" ON "taskComment"("taskId");

-- CreateIndex
CREATE INDEX "projectActivity_projectId_idx" ON "projectActivity"("projectId");

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
CREATE INDEX "fileNode_organizationId_parentId_idx" ON "fileNode"("organizationId", "parentId");

-- CreateIndex
CREATE INDEX "fileNode_ownerId_idx" ON "fileNode"("ownerId");

-- CreateIndex
CREATE INDEX "fileShare_userId_idx" ON "fileShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fileShare_fileId_userId_key" ON "fileShare"("fileId", "userId");

-- CreateIndex
CREATE INDEX "fileVersion_fileId_idx" ON "fileVersion"("fileId");

-- CreateIndex
CREATE INDEX "fileActivity_fileId_idx" ON "fileActivity"("fileId");

-- CreateIndex
CREATE INDEX "chatTeam_organizationId_idx" ON "chatTeam"("organizationId");

-- CreateIndex
CREATE INDEX "conversation_organizationId_idx" ON "conversation"("organizationId");

-- CreateIndex
CREATE INDEX "conversation_teamId_idx" ON "conversation"("teamId");

-- CreateIndex
CREATE INDEX "conversationMember_userId_idx" ON "conversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversationMember_conversationId_userId_key" ON "conversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "message_conversationId_idx" ON "message"("conversationId");

-- CreateIndex
CREATE INDEX "message_parentId_idx" ON "message"("parentId");

-- CreateIndex
CREATE INDEX "messageReaction_messageId_idx" ON "messageReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "messageReaction_messageId_emoji_userId_key" ON "messageReaction"("messageId", "emoji", "userId");

-- CreateIndex
CREATE INDEX "messageAttachment_messageId_idx" ON "messageAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectMember" ADD CONSTRAINT "projectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label" ADD CONSTRAINT "label_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectLabel" ADD CONSTRAINT "projectLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectLabel" ADD CONSTRAINT "projectLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarMember" ADD CONSTRAINT "calendarMember_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarEvent" ADD CONSTRAINT "calendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarEvent" ADD CONSTRAINT "calendarEvent_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventAttendee" ADD CONSTRAINT "eventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileNode" ADD CONSTRAINT "fileNode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileNode" ADD CONSTRAINT "fileNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileShare" ADD CONSTRAINT "fileShare_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileVersion" ADD CONSTRAINT "fileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fileActivity" ADD CONSTRAINT "fileActivity_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "fileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatTeam" ADD CONSTRAINT "chatTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "chatTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversationMember" ADD CONSTRAINT "conversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messageReaction" ADD CONSTRAINT "messageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messageAttachment" ADD CONSTRAINT "messageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
