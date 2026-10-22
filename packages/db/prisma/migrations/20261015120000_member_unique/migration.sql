-- Enforce a single membership per (organization, user).
-- Drop any pre-existing duplicates first, keeping the oldest row per pair.
DELETE FROM "member" a
USING "member" b
WHERE a."organizationId" = b."organizationId"
  AND a."userId" = b."userId"
  AND a."id" > b."id";

CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");
