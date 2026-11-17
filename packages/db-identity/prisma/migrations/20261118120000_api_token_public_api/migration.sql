-- Align the personal-access-token table with the public API model: tokens may
-- never expire, and the hash lookup uses a unique index.
ALTER TABLE "apiToken" ALTER COLUMN "expiresAt" DROP NOT NULL;

CREATE UNIQUE INDEX "apiToken_tokenHash_key" ON "apiToken"("tokenHash");
CREATE INDEX "apiToken_organizationId_createdAt_idx" ON "apiToken"("organizationId", "createdAt");
