/*
  Warnings:

  - You are about to drop the column `endAt` on the `meetingRequest` table. All the data in the column will be lost.
  - You are about to drop the column `startAt` on the `meetingRequest` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "meetingRequest_startAt_idx";

-- AlterTable
ALTER TABLE "meetingRequest" DROP COLUMN "endAt",
DROP COLUMN "startAt";

-- CreateTable
CREATE TABLE "meetingSlot" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "selected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meetingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetingSlot_requestId_idx" ON "meetingSlot"("requestId");

-- CreateIndex
CREATE INDEX "meetingSlot_startAt_idx" ON "meetingSlot"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "meetingSlot_requestId_startAt_key" ON "meetingSlot"("requestId", "startAt");

-- AddForeignKey
ALTER TABLE "meetingSlot" ADD CONSTRAINT "meetingSlot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "meetingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
