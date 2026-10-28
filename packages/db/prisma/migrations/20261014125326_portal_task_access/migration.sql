-- AlterTable
ALTER TABLE "project" ADD COLUMN     "clientDiscussion" TEXT NOT NULL DEFAULT 'read_write',
ADD COLUMN     "clientTaskComments" TEXT NOT NULL DEFAULT 'read_write',
ADD COLUMN     "clientVisible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "taskComment" ADD COLUMN     "authorKind" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN     "authorName" TEXT;
