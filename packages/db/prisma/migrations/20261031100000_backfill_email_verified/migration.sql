-- Accounts created while REQUIRE_EMAIL_VERIFICATION was off were never asked to
-- verify. Mark them verified so turning the flag on does not lock them out.
-- Accounts created after this migration and before the flag is turned on stay
-- unverified; `emailVerification.sendOnSignIn` mails them a link on sign-in.
UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false;
