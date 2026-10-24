-- One-off upgrade for databases created before the Clients/Employees rename.
--
-- Run this against an existing database *before* switching to the squashed
-- baseline migration, then clear `_prisma_migrations` and mark the baseline as
-- applied:
--
--   psql "$DATABASE_URL" -f packages/db/prisma/upgrades/20261024_rename_clients_employees.sql
--   psql "$DATABASE_URL" -c 'DELETE FROM "_prisma_migrations";'
--   cd packages/db && npx prisma migrate resolve --applied 20261024120000_init
--
-- The app must be stopped while this runs: old and new table names cannot
-- coexist across a rolling deployment.

BEGIN;

ALTER TABLE "crmActivity" RENAME TO "clientActivity";
ALTER TABLE "crmFieldDefinition" RENAME TO "clientFieldDefinition";
ALTER TABLE "crmDocument" RENAME TO "clientDocument";
ALTER TABLE "hrProfile" RENAME TO "employeeProfile";
ALTER TABLE "hrSettings" RENAME TO "employeeSettings";

-- Primary keys
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_pkey" TO "clientActivity_pkey";
ALTER TABLE "clientFieldDefinition" RENAME CONSTRAINT "crmFieldDefinition_pkey" TO "clientFieldDefinition_pkey";
ALTER TABLE "clientDocument" RENAME CONSTRAINT "crmDocument_pkey" TO "clientDocument_pkey";
ALTER TABLE "employeeProfile" RENAME CONSTRAINT "hrProfile_pkey" TO "employeeProfile_pkey";
ALTER TABLE "employeeSettings" RENAME CONSTRAINT "hrSettings_pkey" TO "employeeSettings_pkey";

-- Foreign keys
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_organizationId_fkey" TO "clientActivity_organizationId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_clientId_fkey" TO "clientActivity_clientId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_contactId_fkey" TO "clientActivity_contactId_fkey";
ALTER TABLE "clientActivity" RENAME CONSTRAINT "crmActivity_dealId_fkey" TO "clientActivity_dealId_fkey";
ALTER TABLE "clientFieldDefinition" RENAME CONSTRAINT "crmFieldDefinition_organizationId_fkey" TO "clientFieldDefinition_organizationId_fkey";
ALTER TABLE "clientDocument" RENAME CONSTRAINT "crmDocument_organizationId_fkey" TO "clientDocument_organizationId_fkey";
ALTER TABLE "clientDocument" RENAME CONSTRAINT "crmDocument_fileId_fkey" TO "clientDocument_fileId_fkey";
ALTER TABLE "employeeProfile" RENAME CONSTRAINT "hrProfile_organizationId_fkey" TO "employeeProfile_organizationId_fkey";
ALTER TABLE "employeeSettings" RENAME CONSTRAINT "hrSettings_organizationId_fkey" TO "employeeSettings_organizationId_fkey";

-- Standalone and unique indexes
ALTER INDEX "crmActivity_organizationId_occurredAt_idx" RENAME TO "clientActivity_organizationId_occurredAt_idx";
ALTER INDEX "crmActivity_clientId_idx" RENAME TO "clientActivity_clientId_idx";
ALTER INDEX "crmActivity_contactId_idx" RENAME TO "clientActivity_contactId_idx";
ALTER INDEX "crmActivity_dealId_idx" RENAME TO "clientActivity_dealId_idx";
ALTER INDEX "crmFieldDefinition_organizationId_entity_key_key" RENAME TO "clientFieldDefinition_organizationId_entity_key_key";
ALTER INDEX "crmDocument_fileId_entity_entityId_key" RENAME TO "clientDocument_fileId_entity_entityId_key";
ALTER INDEX "crmDocument_organizationId_entity_entityId_idx" RENAME TO "clientDocument_organizationId_entity_entityId_idx";
ALTER INDEX "hrProfile_organizationId_userId_key" RENAME TO "employeeProfile_organizationId_userId_key";
ALTER INDEX "hrSettings_organizationId_key" RENAME TO "employeeSettings_organizationId_key";

-- Existing audit rows carry the old entity names in their denormalized payload.
UPDATE "auditLog" SET "entityType" = 'clientField'
  WHERE "entityType" = 'crmField';
UPDATE "auditLog" SET "entityType" = 'employeeSettings'
  WHERE "entityType" = 'hrSettings';
UPDATE "auditLog" SET "entityType" = 'employeeProfile'
  WHERE "entityType" = 'hrProfile';
UPDATE "auditLog" SET "action" = replace("action", 'crmField.', 'clientField.')
  WHERE "action" LIKE 'crmField.%';
UPDATE "auditLog" SET "action" = replace("action", 'hrSettings.', 'employeeSettings.')
  WHERE "action" LIKE 'hrSettings.%';
UPDATE "auditLog" SET "action" = replace("action", 'hrProfile.', 'employeeProfile.')
  WHERE "action" LIKE 'hrProfile.%';

COMMIT;
