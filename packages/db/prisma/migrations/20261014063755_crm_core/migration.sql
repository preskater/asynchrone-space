-- AlterTable
ALTER TABLE "client" ADD COLUMN     "address" TEXT,
ADD COLUMN     "customFields" JSONB,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'prospect',
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "customFields" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactCompany" (
    "contactId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactCompany_pkey" PRIMARY KEY ("contactId","clientId")
);

-- CreateTable
CREATE TABLE "pipeline" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'open',
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "pipelineId" TEXT,
    "stageId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "probability" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'open',
    "expectedCloseDate" DATE,
    "actualCloseDate" DATE,
    "lossReason" TEXT,
    "source" TEXT,
    "description" TEXT,
    "ownerId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "customFields" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealContact" (
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dealContact_pkey" PRIMARY KEY ("dealId","contactId")
);

-- CreateTable
CREATE TABLE "crmActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "clientId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_organizationId_idx" ON "contact"("organizationId");

-- CreateIndex
CREATE INDEX "contact_organizationId_email_idx" ON "contact"("organizationId", "email");

-- CreateIndex
CREATE INDEX "contactCompany_clientId_idx" ON "contactCompany"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_organizationId_name_key" ON "pipeline"("organizationId", "name");

-- CreateIndex
CREATE INDEX "pipelineStage_pipelineId_position_idx" ON "pipelineStage"("pipelineId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "pipelineStage_pipelineId_name_key" ON "pipelineStage"("pipelineId", "name");

-- CreateIndex
CREATE INDEX "deal_organizationId_status_idx" ON "deal"("organizationId", "status");

-- CreateIndex
CREATE INDEX "deal_clientId_idx" ON "deal"("clientId");

-- CreateIndex
CREATE INDEX "deal_stageId_idx" ON "deal"("stageId");

-- CreateIndex
CREATE INDEX "dealContact_contactId_idx" ON "dealContact"("contactId");

-- CreateIndex
CREATE INDEX "crmActivity_organizationId_occurredAt_idx" ON "crmActivity"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "crmActivity_clientId_idx" ON "crmActivity"("clientId");

-- CreateIndex
CREATE INDEX "crmActivity_contactId_idx" ON "crmActivity"("contactId");

-- CreateIndex
CREATE INDEX "crmActivity_dealId_idx" ON "crmActivity"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "crmFieldDefinition_organizationId_entity_key_key" ON "crmFieldDefinition"("organizationId", "entity", "key");

-- CreateIndex
CREATE INDEX "client_organizationId_status_idx" ON "client"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactCompany" ADD CONSTRAINT "contactCompany_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactCompany" ADD CONSTRAINT "contactCompany_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelineStage" ADD CONSTRAINT "pipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "pipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealContact" ADD CONSTRAINT "dealContact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealContact" ADD CONSTRAINT "dealContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmFieldDefinition" ADD CONSTRAINT "crmFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
