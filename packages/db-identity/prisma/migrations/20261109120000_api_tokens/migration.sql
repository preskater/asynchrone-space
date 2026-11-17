-- Public API personal access tokens.
-- Additive: one new table, no changes to existing ones.

CREATE TABLE "apiToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apiToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "apiToken_hashedToken_key" ON "apiToken"("hashedToken");
CREATE INDEX "apiToken_organizationId_createdAt_idx" ON "apiToken"("organizationId", "createdAt");

ALTER TABLE "apiToken" ADD CONSTRAINT "apiToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
