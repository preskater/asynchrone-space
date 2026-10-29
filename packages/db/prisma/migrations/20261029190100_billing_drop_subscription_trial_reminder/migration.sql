-- Trials are modelled on the organization (ADR 0021), so the subscription no
-- longer bookkeeps trial reminders. `trialEndsAt` stays: it mirrors a trial the
-- payment provider reports on the subscription itself.
ALTER TABLE "subscription" DROP COLUMN IF EXISTS "trialReminderSentAt";
