-- A trial is claimed per company domain, not just per email: two colleagues
-- on the same domain must not be able to start two trials concurrently.
-- Nullable, so public mailbox providers (gmail.com…) stay unblocked.
DROP INDEX "trialClaim_domain_idx";

-- CreateIndex
CREATE UNIQUE INDEX "trialClaim_domain_key" ON "trialClaim"("domain");
