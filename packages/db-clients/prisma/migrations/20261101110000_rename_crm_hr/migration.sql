-- Rename the clients tables in the dedicated database (#147, ADR 0030).
ALTER TABLE "crmActivity" RENAME TO "clientActivity";
ALTER TABLE "crmFieldDefinition" RENAME TO "clientFieldDefinition";
ALTER TABLE "crmDocument" RENAME TO "clientDocument";

ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_pkey" TO "clientActivity_pkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_clientId_fkey" TO "clientActivity_clientId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_contactId_fkey" TO "clientActivity_contactId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_dealId_fkey" TO "clientActivity_dealId_fkey";

ALTER TABLE "clientFieldDefinition" RENAME CONSTRAINT "crmFieldDefinition_pkey" TO "clientFieldDefinition_pkey";

ALTER TABLE "clientDocument" RENAME CONSTRAINT "crmDocument_pkey" TO "clientDocument_pkey";

ALTER INDEX "crmActivity_organizationId_occurredAt_idx" RENAME TO "clientActivity_organizationId_occurredAt_idx";
ALTER INDEX "crmActivity_clientId_idx" RENAME TO "clientActivity_clientId_idx";
ALTER INDEX "crmActivity_contactId_idx" RENAME TO "clientActivity_contactId_idx";
ALTER INDEX "crmActivity_dealId_idx" RENAME TO "clientActivity_dealId_idx";
ALTER INDEX "crmFieldDefinition_organizationId_entity_key_key" RENAME TO "clientFieldDefinition_organizationId_entity_key_key";
ALTER INDEX "crmDocument_organizationId_entity_entityId_idx" RENAME TO "clientDocument_organizationId_entity_entityId_idx";
ALTER INDEX "crmDocument_fileId_entity_entityId_key" RENAME TO "clientDocument_fileId_entity_entityId_key";
