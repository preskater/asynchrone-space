-- Organization policy: members must enroll TOTP before reaching the workspace.
ALTER TABLE "organization" ADD COLUMN "requireTwoFactor" BOOLEAN NOT NULL DEFAULT false;
