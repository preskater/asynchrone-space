# Export organization data asynchronously

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-30

## Context and Problem Statement

GDPR Article 20 (portability) and every procurement review ask the same
question: can a customer take all of their data with them? Files could be
downloaded one at a time, but nothing produced a complete, machine-readable
copy of an organization (issue #88). An organization can hold gigabytes of
file bytes in PostgreSQL large objects (ADR 0005), so an archive can be too
large and too slow to build inside one HTTP request.

How do owners get a complete export without a request timing out, without a
second storage system and without leaving archives around forever?

## Decision Drivers

- Complete: every customer-owned table plus the file bytes, with counts a
  reader can check.
- No credentials or platform-internal records in the archive.
- Only owners: the archive holds salaries, HR records and every member's
  private conversations.
- No new infrastructure: the Helm chart already runs CronJobs, and bytes
  already live in large objects.
- Archives must disappear on their own and with the organization.

## Considered Options

- **Stream the ZIP synchronously** from a route when the owner clicks.
- **Queue an export, build it in a CronJob into a large object, and expire
  it** after a fixed window.
- **Upload archives to an object store** with presigned URLs.

## Decision Outcome

Chosen option: **queue, build in a CronJob, expire**, because it survives
large organizations and slow clients and reuses the storage and scheduling we
already run.

- `DataExport` rows (`pending → processing → ready | failed → expired`) record
  each request. An owner can have one export in flight per organization
  (`apps/web/lib/organization/export-service.ts`).
- The `data-exports` CronJob runs every 15 minutes. It claims each pending
  export with a conditional update and streams the ZIP (`fflate`) straight into
  a new large object. The ZIP holds one JSON file per table, the current file
  bytes, older versions whose bytes differ, message attachments and a
  `manifest.json` with the row count per table.
- Left out: sessions, accounts, OAuth tokens, 2FA, repository webhook secrets,
  platform audit events, handoffs, trial claims, rate limits, billing webhook
  logs and unfinished uploads.
- The requester gets an email. The archive downloads from
  `/api/organizations/exports/{id}/download`, which checks the session, the
  owner role, the organization and the expiry.
- After 7 days the same job unlinks the archive and marks the row `expired`.
  A build interrupted for an hour is marked `failed` so the owner can retry.
  Organization deletion also unlinks archives (ADR 0024).
- `npm run verify:data-export --workspace=web` checks the permissions, the
  archive against the database, the absence of secrets, expiry and deletion.

## Consequences

### Positive

- Exports work for any size of organization without an HTTP timeout.
- No new service or bucket; backups and deletion already cover large objects.
- Archives cannot pile up: they expire and go with the organization.

### Negative

- An export can take up to 15 minutes to start.
- Each table is read whole into memory while its JSON file is written. A very
  large organization may need paging later.
- While it exists, an archive doubles the storage of the organization's bytes.
