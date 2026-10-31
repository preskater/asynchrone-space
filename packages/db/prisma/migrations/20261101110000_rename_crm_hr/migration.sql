-- Rename CRM/HR tables to the Clients/Employees vocabulary (ADR 0030, #147).
-- Keep the migration history; this changes names in place and preserves rows.
ALTER TABLE "crmActivity" RENAME TO "clientActivity";
ALTER TABLE "crmFieldDefinition" RENAME TO "clientFieldDefinition";
ALTER TABLE "crmDocument" RENAME TO "clientDocument";
ALTER TABLE "hrProfile" RENAME TO "employeeProfile";
ALTER TABLE "hrSettings" RENAME TO "employeeSettings";

-- Rename the primary-key and foreign-key constraints so a fresh schema and a
-- migrated database have the same names.
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_pkey" TO "clientActivity_pkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_organizationId_fkey" TO "clientActivity_organizationId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_clientId_fkey" TO "clientActivity_clientId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_contactId_fkey" TO "clientActivity_contactId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_dealId_fkey" TO "clientActivity_dealId_fkey";

ALTER TABLE "clientFieldDefinition" RENAME CONSTRAINT "crmFieldDefinition_pkey" TO "clientFieldDefinition_pkey";
ALTER TABLE "clientFieldDefinition" RENAME CONSTRAINT "crmFieldDefinition_organizationId_fkey" TO "clientFieldDefinition_organizationId_fkey";

ALTER TABLE "clientDocument" RENAME CONSTRAINT "crmDocument_pkey" TO "clientDocument_pkey";
ALTER TABLE "clientDocument" RENAME CONSTRAINT "crmDocument_organizationId_fkey" TO "clientDocument_organizationId_fkey";
ALTER TABLE "clientDocument" RENAME CONSTRAINT "crmDocument_fileId_fkey" TO "clientDocument_fileId_fkey";

ALTER TABLE "employeeProfile" RENAME CONSTRAINT "hrProfile_pkey" TO "employeeProfile_pkey";
ALTER TABLE "employeeProfile" RENAME CONSTRAINT "hrProfile_organizationId_fkey" TO "employeeProfile_organizationId_fkey";

ALTER TABLE "employeeSettings" RENAME CONSTRAINT "hrSettings_pkey" TO "employeeSettings_pkey";
ALTER TABLE "employeeSettings" RENAME CONSTRAINT "hrSettings_organizationId_fkey" TO "employeeSettings_organizationId_fkey";

-- Rename indexes (Prisma derives their names from the table name).
ALTER INDEX "crmActivity_organizationId_occurredAt_idx" RENAME TO "clientActivity_organizationId_occurredAt_idx";
ALTER INDEX "crmActivity_clientId_idx" RENAME TO "clientActivity_clientId_idx";
ALTER INDEX "crmActivity_contactId_idx" RENAME TO "clientActivity_contactId_idx";
ALTER INDEX "crmActivity_dealId_idx" RENAME TO "clientActivity_dealId_idx";
ALTER INDEX "crmFieldDefinition_organizationId_entity_key_key" RENAME TO "clientFieldDefinition_organizationId_entity_key_key";
ALTER INDEX "crmDocument_organizationId_entity_entityId_idx" RENAME TO "clientDocument_organizationId_entity_entityId_idx";
ALTER INDEX "crmDocument_fileId_entity_entityId_key" RENAME TO "clientDocument_fileId_entity_entityId_key";
ALTER INDEX "hrProfile_organizationId_userId_key" RENAME TO "employeeProfile_organizationId_userId_key";
ALTER INDEX "hrSettings_organizationId_key" RENAME TO "employeeSettings_organizationId_key";
