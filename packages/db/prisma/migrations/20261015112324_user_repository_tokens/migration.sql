/*
  Warnings:

  - You are about to drop the column `accessToken` on the `repositoryConnection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "repositoryConnection" DROP COLUMN "accessToken";

-- CreateTable
CREATE TABLE "userRepositoryToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "userRepositoryToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "userRepositoryToken_userId_idx" ON "userRepositoryToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "userRepositoryToken_userId_provider_key" ON "userRepositoryToken"("userId", "provider");

-- AddForeignKey
ALTER TABLE "userRepositoryToken" ADD CONSTRAINT "userRepositoryToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
