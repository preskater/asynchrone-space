-- AlterTable
ALTER TABLE "task" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "taskTemplate" ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "task_templateId_idx" ON "task"("templateId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "taskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
