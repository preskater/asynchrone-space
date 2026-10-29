# Model the Team trial as a time window, not a plan change

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-29

## Context and Problem Statement

Pricing advertises a 14-day Team trial ("Start 14-day trial") but nothing
backed it (issue #84). There is no billing provider or checkout yet: the plan
lives in `organization.metadata.plan` and only the control tower changes it.
The only Team entitlement today is the storage quota.

How do we start, remind about, and end a trial so that a late or repeated
cron can never strand data, double-downgrade, or re-notify?

## Decision Drivers

- The trial must end on time even if the expiry job is late or down.
- Expiry must never delete or hide workspace data.
- Running the job twice must change nothing.
- One trial per organization, verified email, no re-trial on the same email
  or company domain.
- No billing provider yet; do not build one for the trial.

## Considered Options

- **Trial window.** Store `trialStartedAt`/`trialEndsAt` on the organization
  and treat a free organization as Team while `trialEndsAt` is in the future.
  The cron only records reminders/expiry and notifies.
- **Plan flip.** Write `metadata.plan = "team"` on start and have the cron
  write it back to `"free"` at expiry.

## Decision Outcome

Chosen option: **Trial window**, because the downgrade then happens exactly at
`trialEndsAt` without the cron, and the cron cannot overwrite a plan an
operator set in the meantime.

- `effectivePlan()` (`apps/web/lib/organization/trial.ts`) is the single place
  that resolves the enforced plan; the storage quota goes through it.
- The trial starts from an explicit "Start 14-day trial" action in workspace
  settings (owners/admins only), since there is no checkout.
- `GET /api/cron/trial-expiry` runs daily (`trial-expiry` CronJob). It sends
  the D-3 reminder and the end-of-trial notice. Each step is claimed with a
  conditional update on `trialReminderSentAt`/`trialEndedAt`, so a step runs
  at most once. A cron that missed D-3 skips straight to expiry.
- `TrialClaim` records the normalized email and company domain of every
  trial. It has no foreign key, so deleting a workspace does not free them.
  Public mailbox domains (gmail.com…) are not blocked by domain.

## Consequences

- Good: no data is touched at expiry; a missed cron run only delays emails.
- Good: organizations moved to a paid plan during the trial keep it and get
  no "trial ended" email.
- Bad: the control tower still shows the stored plan (`free`) for an
  organization on trial.
- Bad: "optional payment method" from #84 is out of scope until billing exists.
- Neutral: once billing exists, a Team checkout can start the trial through
  the same `startTeamTrial()` service.

## Links

- Issue #84, commercialization tracker #102
- [0019](0019-deploy-on-kubernetes-with-helm.md) for the CronJob setup
