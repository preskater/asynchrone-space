-- CreateTable
CREATE TABLE "ai_usage_event" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requests" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cachedTokens" INTEGER NOT NULL,
    "costMicros" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_event_organizationId_createdAt_idx" ON "ai_usage_event"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_event_createdAt_idx" ON "ai_usage_event"("createdAt");

-- AddForeignKey
ALTER TABLE "ai_usage_event" ADD CONSTRAINT "ai_usage_event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
