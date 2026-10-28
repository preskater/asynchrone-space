-- AlterTable
ALTER TABLE "member" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "portalInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "invitationId" TEXT,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "portalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portalInvite_invitationId_key" ON "portalInvite"("invitationId");

-- CreateIndex
CREATE INDEX "portalInvite_organizationId_clientId_idx" ON "portalInvite"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "portalInvite_email_idx" ON "portalInvite"("email");

-- CreateIndex
CREATE INDEX "member_clientId_idx" ON "member"("clientId");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portalInvite" ADD CONSTRAINT "portalInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portalInvite" ADD CONSTRAINT "portalInvite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
