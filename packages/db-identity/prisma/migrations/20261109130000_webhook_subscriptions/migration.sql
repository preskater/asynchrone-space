-- Outbound webhook endpoints.
-- Additive: one new table, no changes to existing ones.

CREATE TABLE "webhookSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "webhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhookSubscription_organizationId_createdAt_idx" ON "webhookSubscription"("organizationId", "createdAt");

ALTER TABLE "webhookSubscription" ADD CONSTRAINT "webhookSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
