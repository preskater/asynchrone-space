-- Customer TOTP lives apart from the control tower's `twoFactor` table: each
-- auth instance encrypts secrets with its own key (ADR 0018), so sharing the
-- table or the `twoFactorEnabled` flag would lock one side out.
ALTER TABLE "user" ADD COLUMN "customerTwoFactorEnabled" BOOLEAN DEFAULT false;

CREATE TABLE "customerTwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "customerTwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customerTwoFactor_userId_idx" ON "customerTwoFactor"("userId");

ALTER TABLE "customerTwoFactor" ADD CONSTRAINT "customerTwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
