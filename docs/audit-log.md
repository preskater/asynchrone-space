# Audit log

Organization owners and admins get a first-class audit trail of everything
sensitive that happened in their workspace: who did it, on what, from which
address, and what changed. The decision is recorded in
[ADR 0025](adr/0025-customer-facing-audit-log.md).

## Where things live

| Concern                       | Location                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Table                         | `AuditLog` (`packages/db/prisma/schema.prisma`)                                |
| Action and entity catalogues  | `apps/web/lib/audit/actions.ts`                                                |
| The only write path           | `apps/web/lib/audit/record.ts` (`recordAudit`, `recordUserAudit`, …)           |
| Auth-endpoint coverage        | `apps/web/lib/audit/auth-audit.ts` (Better Auth `after` hook)                  |
| Reads, filters, export        | `apps/web/lib/audit/service.ts`                                                |
| Retention policy and cleanup  | `apps/web/lib/audit/retention.ts`, `apps/web/lib/audit/prune.ts`               |
| Settings → Audit log          | `apps/web/components/audit/*`, tab `?tab=audit`                                |
| Daily cleanup                 | `apps/web/app/api/cron/audit-retention/route.ts` (CronJob `audit-retention`)   |
| Manual check                  | `npm run verify:audit-log --workspace=web` (needs a live database)             |

## Writing a row

Every mutating server action records its change with the shared helper, in the
same service method that performs the write:

```ts
import { AUDIT_ACTIONS } from "@/lib/audit/actions"
import { recordUserAudit } from "@/lib/audit/record"

await recordUserAudit(
  ctx,
  {
    action: AUDIT_ACTIONS.taskDeleted,
    entityType: "task",
    entityId: existing.id,
    entityLabel: existing.identifier,
    before: { title: existing.title, status: existing.status },
  },
  this.db // pass a transaction client when the mutation runs in one
)
```

Rules of thumb:

- `recordUserAudit` fills the organization, the actor (id, name, email) and the
  request IP / user agent. `recordSystemAudit` is for jobs and provider
  webhooks; `recordAudit` is for callers that already hold every field.
- One row per changed entity and per operation — a bulk delete writes one row
  per deleted file, not one per request.
- Snapshot `entityLabel` (task key, member email, file name): the target may be
  deleted later and the row must stay readable.
- Errors propagate. A mutation that cannot be audited fails instead of changing
  data silently.
- New actions go into `AUDIT_ACTIONS` and get a label under `actions.<action>`
  in `messages/{en,fr}/audit.json`. Unknown actions still render, with their raw
  value as the label, so older rows survive a rename.

Organization member, role and invitation changes go through Better Auth's HTTP
endpoints rather than a server action. They are covered by the `after` hook in
`apps/web/lib/auth.ts`, which sees the acting session (Better Auth's
`organizationHooks` only receive the target member, which is not enough for an
audit trail).

Content additions — task comments, messages, chat — are deliberately not
audited: the project activity feed covers them and they would drown the
security-relevant trail.

## Reading it

`GET`-shaped server actions in `apps/web/actions/audit.ts` power the page:

| Action                     | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `listAuditLogAction`       | One keyset page (50 rows) for the active filter, plus a total |
| `loadAuditFacetsAction`    | Distinct actions, target types and actors in the window       |
| `exportAuditLogAction`     | CSV or JSON of the active filter, capped at 5000 rows         |
| `getAuditRetentionAction`  | Effective window and whether it is configurable               |
| `setAuditRetentionAction`  | Enterprise override, owner only                               |

Access is checked twice: `roleRank >= admin` (members and viewers get a 403) and
the `auditLog` entitlement. Client-portal accounts never reach the workspace.
The filter days are **UTC** days, so `from=2026-10-01&to=2026-10-01` covers
`2026-10-01T00:00:00Z` through `2026-10-01T23:59:59.999Z`.

An export over the cap is truncated and the UI warns; narrow the date range to
collect the rest.

## Retention

| Plan       | Window   |
| ---------- | -------- |
| Free       | 30 days  |
| Team       | 365 days |
| Enterprise | 730 days, overridable between 30 and 3650 (`organization.metadata.auditRetentionDays`) |

A Team trial counts as Team. The window is enforced by the daily
`/api/cron/audit-retention` job (`pruneAuditLogs`), which walks every
organization, deletes rows older than its cutoff in batches of 5000, and caps
each organization at 20 batches per run so a backlog never holds a long lock —
the next run continues where the last one stopped. It only touches `AuditLog`:
the control tower's `PlatformAuditEvent` is a separate table with its own
lifecycle and is never pruned here.

Rows are still written on plans that cannot read them (Free, Team) so an
upgrade immediately shows the history inside the window, and so the table never
grows without bound.

## Out of scope

Real-time streaming, shipping events to an external SIEM (a future Enterprise
option), and platform-level auditing, which lives in the control tower. A plan
change applied from the control tower is recorded as a `PlatformAuditEvent`
there; the billing path records `organization.plan.changed` here.
