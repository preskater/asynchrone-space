-- Replaces Vercel Blob pathnames with PostgreSQL large-object references.
-- Bytes are streamed into pg_largeobject via lib/large-object.ts and the oid is
-- stored here. No existing Blob data is migrated: storageKey is dropped and
-- existing rows simply have no bytes attached.

-- AlterTable
ALTER TABLE "fileNode" DROP COLUMN "checksum",
DROP COLUMN "storageKey",
ADD COLUMN     "oid" BIGINT,
ADD COLUMN     "sha256" TEXT;

-- AlterTable
ALTER TABLE "fileVersion" DROP COLUMN "storageKey",
ADD COLUMN     "oid" BIGINT,
ADD COLUMN     "sha256" TEXT;

-- AlterTable
ALTER TABLE "messageAttachment" DROP COLUMN "storageKey",
ADD COLUMN     "oid" BIGINT,
ADD COLUMN     "sha256" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "fileNode_oid_key" ON "fileNode"("oid");
