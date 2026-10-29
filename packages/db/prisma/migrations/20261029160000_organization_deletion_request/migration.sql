-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "deletionRequestedById" TEXT,
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3);
