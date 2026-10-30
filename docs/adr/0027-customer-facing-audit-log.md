# Expose a customer-facing audit log with filters, export and retention

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-31

## Context and Problem Statement

`AuditLog` rows were already written by the CRM, HR, trial and deletion code,
but the trail was only readable from the control tower's organization page. The
customer paying for "Audit log and retention" could not see their own history,
could not answer "who deleted this project", and could not hand a security
reviewer anything. At the same time the table grew without bound, and coverage
was accidental: some mutations wrote a row, others (projects, files, members,
roles, plan changes) wrote none (issue #92).

How do we ship a first-class audit trail without a second event pipeline, and
how do we stop new server actions from silently forgetting to audit?

## Decision Drivers

- Owners and admins can read, filter and export everything security-relevant;
  members and viewers must not.
- Every mutating action writes exactly one row with the actor and the target,
  including changes made through Better Auth's organization endpoints.
- Rows stay readable after the actor or the target is deleted.
- Unbounded growth is not acceptable; retention follows the plan and is
  enforced by a job, not by operator memory.
- One write path, so the table, the page and the export cannot drift apart.
- No new infrastructure: the Helm chart already runs daily CronJobs.

## Considered Options

- **Keep `AuditLog` internal** (control tower only) and sell the Enterprise
  feature later.
- **Derive the trail from project activity and Better Auth logs**: cheap, but
  incomplete, not attributable per organization and impossible to export.
- **One customer-facing table with one shared write helper**, read through a
  dedicated service, pruned by a daily job.

## Decision Outcome

Chosen option: **One customer-facing table with one shared write helper**.

- `AuditLog` gained `actorName`, `actorEmail`, `entityLabel`, `ipAddress` and
  `userAgent`, plus `(organizationId, action, createdAt)` and
  `(organizationId, entityType, createdAt)` indexes. Actor and target labels are
  snapshotted so a row survives the deletion of either; the read path still
  resolves a name from `user` for rows written before this change.
- `apps/web/lib/audit/record.ts` is the only writer (`recordAudit`,
  `recordUserAudit`, `recordSystemAudit`, bulk variants). It fills the actor and
  the request metadata from the trusted IP headers, and it propagates errors: a
  mutation that cannot be audited fails rather than changing data silently. The
  CRM and HR repositories, the trial, deletion and portal services now go
  through it instead of calling `prisma.auditLog.create` directly.
- Actions are catalogued in `apps/web/lib/audit/actions.ts` and labelled under
  `Audit.actions.<action>` in both locales; unknown actions render with their
  raw value, so older rows keep working.
- Member, role and invitation changes go through Better Auth endpoints, so they
  are audited from the auth `after` hook (`apps/web/lib/audit/auth-audit.ts`).
  The hook sees the acting session; `organizationHooks` only receive the target
  member and cannot attribute the change.
- Settings → Audit log is a tab of the organization settings page
  (`?tab=audit`), gated by `roleRank >= admin` and the `auditLog` entitlement.
  Reads use keyset pagination and a total count; the export reuses the same
  filter and is capped at 5000 rows, reporting truncation.
- Retention is a plan property: 30 days on Free, 365 on Team, 730 on Enterprise
  with a per-organization override clamped to 30–3650 days
  (`metadata.auditRetentionDays`, owner only). The `audit-retention` CronJob
  prunes in batches, leaves a large backlog for the next run, and never touches
  `PlatformAuditEvent`.
- Audit rows are written even on plans that cannot read them, so an upgrade
  immediately shows the history inside the window and the table stays bounded.

## Consequences

### Positive

- The feature the pricing page sells exists, with filters, export and a
  documented retention window.
- Coverage is testable: `verify:audit-log` checks that a task deletion, a role
  change and a member removal each produce exactly one row with actor and
  target, alongside gating, filtering, export caps and pruning.
- One writer means the retention job, the page and the export always agree on
  the shape of a row.

### Negative

- The auth `after` hook runs on every auth request and matches on the path; it
  adds a constant, small cost to the auth pipeline.
- Plan changes applied from the control tower are recorded as
  `PlatformAuditEvent` (the documented platform invariant), so a workspace whose
  plan was changed by support sees `organization.plan.changed` only for the
  billing path.
- Content additions (comments, messages) are intentionally not audited, so the
  trail is a record of configuration and data lifecycle, not of every edit.
