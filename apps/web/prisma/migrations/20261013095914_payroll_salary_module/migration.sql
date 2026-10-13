-- AlterTable
ALTER TABLE "hrSettings" ADD COLUMN     "defaultEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 22,
ADD COLUMN     "defaultEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 42;

-- CreateTable
CREATE TABLE "salaryProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salaryType" TEXT NOT NULL DEFAULT 'full_time',
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeRate" DOUBLE PRECISION NOT NULL DEFAULT 22,
    "employerRate" DOUBLE PRECISION NOT NULL DEFAULT 42,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salaryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salaryProfile_organizationId_userId_key" ON "salaryProfile"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "salaryProfile" ADD CONSTRAINT "salaryProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
