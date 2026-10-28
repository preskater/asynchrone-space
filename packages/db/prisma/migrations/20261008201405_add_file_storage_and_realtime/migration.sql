-- AlterTable
ALTER TABLE "fileNode" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "fileVersion" ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "messageAttachment" ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "storageQuotaBytes" BIGINT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);
