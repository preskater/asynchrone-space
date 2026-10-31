# Keep audit, export and deletion consistent across databases

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-31

## Context and Problem Statement

ADR 0032 gives every app its own database, so there is no single transaction
that can cover a workspace mutation, its audit row, the customer data export and
organization deletion. The current audit invariant is explicit: the mutation
that changes an entity records the audit row itself, and a failed audit write
fails the action. Export and deletion currently walk one Prisma client.

How do we keep the audit trail complete, the export complete and deletion
idempotent without a distributed transaction?

## Decision Drivers

- **Transactional audit.** A successful mutation must have an audit row; a
  failed audit write must fail the mutation.
- **Complete export.** Every customer-owned row and every file byte must appear
  in the archive.
- **Idempotent deletion.** A retry must not delete the wrong rows or leave
  orphans.
- **No shared audit table.** The identity database must not become a second
  shared database.
- **Operable failures.** A down app must not silently drop audit events or leave
  a deletion half-finished.

## Considered Options

1. Central audit service with an outbox in every app.
2. Per-app audit tables with Copilot aggregation.
3. A shared audit database that every app writes to directly.
4. Best-effort audit calls over HTTP without an outbox.

## Decision Outcome

Chosen option: **per-app audit tables with Copilot aggregation**, plus
orchestrated export and deletion sagas.

### Audit

- Every app database has an `AuditLog` table with the same shape.
- `@workspace/audit` is parameterized by the app's database client. The mutation
  writes its audit row in the same transaction, preserving the current
  invariant.
- Copilot's Settings → Audit log calls each app's `GET /internal/audit` with the
  filter and a per-app cursor, merges the pages by `createdAt` and returns one
  page plus the next per-app cursors.
- Export calls the same internal endpoints, merges the rows and caps the result
  at the existing 5000-row limit.
- Retention is enforced per app. Copilot's entitlement decides the window and
  calls each app's prune endpoint from the `audit-retention` job.
- Control tower keeps `PlatformAuditEvent` in its own database; it never enters
  the customer trail.

### Data export

- `DataExport` stays in the identity database and becomes an orchestration job.
- Copilot asks each app for `GET /internal/export` and streams its part into the
  archive. Each part includes a per-table row count and a manifest entry.
- Files exports large-object bytes through the files app; other apps export only
  file IDs and metadata.
- A failed app marks the export `failed` with a retryable error. Partial archives
  are never marked ready.
- The archive records the app versions and schema versions used to build it.

### Organization and user deletion

- `OrganizationDeletionJob` and `UserDeletionJob` live in the identity database
  and carry one status row per app.
- Copilot calls each app's idempotent `DELETE /internal/organizations/:id` or
  `/internal/users/:id`. Each app deletes or anonymizes its own rows and returns
  counts. Files unlinks every large object.
- The identity app is cleaned last, after every domain app reports success.
- A failed app leaves the job `processing`; the cron retries the app, not the
  whole job. Alerts fire when a job exceeds its deadline.
- There is no cross-database transaction. Idempotency keys and status rows are
  the consistency mechanism.

## Consequences

### Positive

- The audit row stays in the same transaction as the mutation.
- No app receives credentials for another app's database.
- Export and deletion failures are visible and retryable per app.
- Each app owns its retention and deletion rules.

### Negative

- Audit pagination and export are fan-out operations; latency grows with the
  number of apps.
- Export and deletion are eventually consistent and need progress UI, retries
  and alerts.
- A partial deletion is visible until the retry completes.
- The audit filter must be understood by every app; the contract needs versioning.
- Testing requires multi-database fixtures and failure injection.

## Links

- [0027](0027-customer-facing-audit-log.md) — the audit log contract
- [0028](0028-split-workspace-into-domain-apps.md) — the app split
- [0032](0032-give-each-app-its-own-database.md) — database per app
- [0026](0026-export-organization-data-asynchronously.md) — the existing export
  flow
- [0024](0024-delete-organizations-after-a-grace-period.md) — organization
  deletion
