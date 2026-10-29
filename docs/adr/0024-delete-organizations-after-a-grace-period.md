# Delete organizations after a grace period

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-29

## Context and Problem Statement

The privacy policy promises that deleted data is removed within 30 days, and
organizations can hold large objects (file bytes) in the same database as their
metadata. The product used Better Auth's `organization.delete`, which ran
immediately from the settings dialog: a single mistyped click destroyed a
workspace with no way back, and it left the PostgreSQL large objects behind
because Better Auth only deletes the rows it knows about (issue #88).

How do we delete an organization so that the promise is kept, an accident is
recoverable, and no file bytes are orphaned — without a second job runner?

## Decision Drivers

- 30-day recoverable window before anything is destroyed (privacy policy, and
  a cheap answer to the "I deleted the wrong workspace" support request).
- Only an owner may request it; every member must see that it is happening.
- No data loss: file bytes must be unlinked only after the rows are gone.
- A late, repeated or overlapping job must be harmless.
- The audit trail must survive the deletion.
- No new infrastructure: the Helm chart already runs daily CronJobs.

## Considered Options

- **Immediate deletion** (Better Auth's `organization.delete`), with the file
  cleanup bolted on.
- **Soft delete**: a `deletedAt` flag that hides the organization but keeps all
  rows and bytes indefinitely.
- **Grace period plus a daily job**: an owner schedules a date, the
  organization keeps working until then, cancellation is a single update, and
  a CronJob performs the final delete.

## Decision Outcome

Chosen option: **Grace period plus a daily job**, because it makes the promise
true without keeping data forever, and it puts retention in the product rather
than in an operator's memory.

- `Organization.deletionScheduledAt` (nullable) plus `deletionRequestedById`.
  Requesting requires the `owner` role and retyping the organization name, and
  runs as a conditional `updateMany … WHERE deletionScheduledAt IS NULL`, so a
  second request cannot move the date and a cancel always wins a race with the
  job (`apps/web/lib/organization/deletion-service.ts`).
- Every member sees a banner while the date is set; the owner can cancel from
  Settings → Danger zone. Cancelling only clears the two columns.
- Better Auth's own `organization.delete` is disabled
  (`disableOrganizationDeletion: true` in `apps/web/lib/auth.ts`) so no code
  path bypasses the grace period.
- The `organization-deletion` CronJob calls
  `/api/cron/organization-deletion` daily (ADR 0019), which deletes every
  organization whose date has passed: the row inside a transaction (cascades
  handle the schema), the two FK-less tables (`uploadSession`,
  `platformHandoff`) explicitly, and the file large objects after the commit —
  never before, so a failed delete cannot lose bytes. A failed unlink leaves an
  orphan, reported by `verify:organization-deletion`.
- `PlatformAuditEvent` records the deletion; it and `TrialClaim` intentionally
  outlive the organization, and the privacy policy's retention clause discloses
  both (`apps/web/messages/en/legal.json`, `fr/legal.json`).

## Consequences

### Positive

- Deleting is reversible for 30 days and never happens by accident.
- File bytes are removed with the metadata, so the 30-day promise covers them.
- Idempotent: a partially failed run is finished by the next, and a cancel that
  lands first makes the job a no-op.

### Negative

- Data lives on for up to 30 days after the request, so a mistaken "delete
  everything now" is not possible without an operator.
- An unlink that fails leaves an orphan large object until someone notices; the
  verify script reports them and a sweep is the obvious follow-up.
- Two records survive (audit events, trial claims); that has to stay disclosed
  in the privacy policy.
