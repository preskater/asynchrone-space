-- Expose the audit trail to organization owners and admins: snapshot the actor
-- and target labels so rows stay readable after either is deleted, and record
-- the request metadata security reviewers ask for.
ALTER TABLE "auditLog" ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "actorEmail" TEXT,
ADD COLUMN     "entityLabel" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- Filtering by action and by target type is part of the settings page.
CREATE INDEX "auditLog_organizationId_action_createdAt_idx" ON "auditLog"("organizationId", "action", "createdAt");
CREATE INDEX "auditLog_organizationId_entityType_createdAt_idx" ON "auditLog"("organizationId", "entityType", "createdAt");
