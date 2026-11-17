-- Outbound webhook delivery log.
-- Additive: one new table, no changes to existing ones.

CREATE TABLE "webhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "webhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhookDelivery_subscriptionId_eventId_key" ON "webhookDelivery"("subscriptionId", "eventId");
CREATE INDEX "webhookDelivery_status_nextAttemptAt_idx" ON "webhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "webhookDelivery_organizationId_createdAt_idx" ON "webhookDelivery"("organizationId", "createdAt");
CREATE INDEX "webhookDelivery_createdAt_idx" ON "webhookDelivery"("createdAt");

ALTER TABLE "webhookDelivery" ADD CONSTRAINT "webhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhookDelivery" ADD CONSTRAINT "webhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "webhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
