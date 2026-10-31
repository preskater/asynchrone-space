# Rename CRM and HR to Clients and Employees

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-30

## Context and Problem Statement

The customer-facing product calls the CRM surface **Clients** and the HR
surface **Employees**, but the code, database and MCP tools call them `crm` and
`hr`. The split in ADR 0028 would otherwise extract `@workspace/crm` and
`@workspace/hr`, then rename both packages and their apps immediately after,
doubling the migration work and leaving two vocabularies in the repository.

The rename is not a folder move: Prisma models and tables, routes, hosts, MCP
tool names, i18n keys, data-export keys and audit entity names all change.

## Decision Drivers

- One vocabulary in UI, docs, code, schema and tools.
- Preserve every existing row; no data loss and no migration-history rewrite.
- Avoid extracting the same domains twice during the split.
- Keep `/clients`, `/contacts` and `/deals` URLs, which already match the
  product vocabulary.
- Make the breaking API change explicit rather than leaving permanent aliases.

## Considered Options

1. Keep `crm` and `hr` everywhere until after the split.
2. Rename only the customer-facing surfaces and app/package names, keeping the
   `Crm*`/`Hr*` models and tables.
3. Rename apps, packages, routes, models, tables, MCP tools and export keys
   together, with one maintenance window.

## Decision Outcome

Chosen option: **full rename**, because the split is the right moment to leave
one vocabulary and the project has no compatibility guarantee for MCP tools
yet.

### Schema

| Current model        | New model               | Current table        | New table               |
| -------------------- | ----------------------- | -------------------- | ----------------------- |
| `CrmActivity`        | `ClientActivity`        | `crmActivity`        | `clientActivity`        |
| `CrmFieldDefinition` | `ClientFieldDefinition` | `crmFieldDefinition` | `clientFieldDefinition` |
| `CrmDocument`        | `ClientDocument`        | `crmDocument`        | `clientDocument`        |
| `HrProfile`          | `EmployeeProfile`       | `hrProfile`          | `employeeProfile`       |
| `HrSettings`         | `EmployeeSettings`      | `hrSettings`         | `employeeSettings`      |

The existing `Client`, `Contact`, `Pipeline`, `Deal` and `Leave*` models keep
their names. A new migration issues `ALTER TABLE ... RENAME TO` for each table;
the migration history is never replaced with a baseline.

### Applications, packages and routes

- `apps/crm` → `apps/clients`, `apps/hr` → `apps/employees`.
- `@workspace/crm` → `@workspace/clients`, `@workspace/hr` →
  `@workspace/employees`.
- Hosts: `crm.copilot.asynchrone.space` →
  `clients.copilot.asynchrone.space`, `hr.copilot.asynchrone.space` →
  `employees.copilot.asynchrone.space`.
- `/hr` becomes `/employees` with a permanent redirect. `/clients`,
  `/contacts` and `/deals` stay unchanged.
- Code folders `lib/crm`, `components/crm`, `actions/crm.ts` and the `(crm)`
  route group follow the same rename.

### API, copy and exports

- MCP tools `crm_*` and `hr_*` become `clients_*` and `employees_*` with **no
  aliases**. This is a breaking change for MCP clients and is documented in the
  release notes.
- i18n namespaces and enum keys (`crmClientStatus`, `crmActivityType`,
  `crmFieldType`, `crmDocumentVisibility`, and the HR equivalents) are renamed
  in English and French.
- Data-export table keys (`crmActivity`, `hrProfile`, …), audit entity names,
  `AUDIT_ACTIONS` values, the `Audit.actions.*` labels in
  `apps/web/messages/{en,fr}/audit.json`, organization-deletion references and
  the `verify:*` scripts are updated.
- Existing downloaded archives keep their old keys; new archives use the new
  names. Existing audit rows keep the labels they were written with; no
  backfill is attempted.

### Rollout

The old and new code cannot share a database with renamed tables, so the
rename ships in a maintenance window:

1. Apply the migration to a copy of the production database and verify
   `prisma migrate diff` reports no drift.
2. Run the data-export, organization-deletion, audit-log and authorization
   verification scripts against the copy.
3. Stop writes, deploy the migration and the renamed code together, then run
   the smoke tests.
4. If the release must be rolled back, rename the tables back with the reverse
   `ALTER TABLE` statements before redeploying the previous image.

## Consequences

- The product, code, schema and tools finally use the same names.
- Users keep `/clients`, `/contacts` and `/deals`; `/hr` redirects.
- MCP clients must update tool names; there is no compatibility window.
- The release needs a short write freeze. Rolling back requires the reverse
  table rename, not just an image rollback.
- Audit and export consumers see new entity/table names after the release.

## Links

- Issue [#147](https://github.com/preskater/asynchrone-space/issues/147)
- [0028](0028-split-workspace-into-domain-apps.md) — the split that follows
  the rename
- Reference implementation: PR
  [#78](https://github.com/preskater/asynchrone-space/pull/78)
