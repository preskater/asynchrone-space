# Rename the CRM and HR apps to Clients and Employees

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-24

## Context and Problem Statement

The workspace split (ADR 0020) created `apps/crm` and `apps/hr`. The product now
uses **Clients** for the client/contact/deal app and **Employees** for the
people/time/leave/payroll app. Leaving the old names in place would make the
navigation, URLs, package names, MCP tools and database schema disagree with the
product vocabulary.

## Decision Drivers

- One vocabulary across UI, URLs, code and deployment.
- No mixed `crm`/`hr` identifiers left in a brand-new split.
- A clean migration history for new installations.
- Preserve data in existing installations.

## Decision Outcome

Chosen option: **rename everything**, with a fresh baseline migration and a
one-off upgrade script for existing databases.

### Renames

- Apps/packages: `apps/crm` + `@workspace/crm` → `apps/clients` +
  `@workspace/clients`; `apps/hr` + `@workspace/hr` → `apps/employees` +
  `@workspace/employees`.
- Hosts/env/images: `clients.presk.re`/`CLIENTS_APP_URL`/`presk-clients` and
  `employees.presk.re`/`EMPLOYEES_APP_URL`/`presk-employees`.
- Routes: `/hr` → `/employees`; the clients app keeps `/clients`, `/contacts`
  and `/deals`.
- Prisma models: `CrmActivity` → `ClientActivity`,
  `CrmFieldDefinition` → `ClientFieldDefinition`,
  `CrmDocument` → `ClientDocument`, `HrProfile` → `EmployeeProfile`,
  `HrSettings` → `EmployeeSettings`.
- Tables: `crmActivity`, `crmFieldDefinition`, `crmDocument`, `hrProfile`,
  `hrSettings` → `clientActivity`, `clientFieldDefinition`,
  `clientDocument`, `employeeProfile`, `employeeSettings`.
- MCP tools: `crm_*`/`hr_*` → `clients_*`/`employees_*` with no aliases.
- i18n namespaces: `Crm`/`Hr` → `Clients`/`Employees`; FR labels “Clients” and
  “Employés”.

`Client`, `Contact`, `Deal` and the attendance/leave/payroll models keep their
names and columns.

### Migrations

The 30 existing migrations are replaced by one baseline generated from the
renamed schema. New environments run `prisma migrate deploy` normally.

Existing environments run a one-off SQL script
(`packages/db/prisma/upgrades/20261024_rename_clients_employees.sql`) that
renames the five tables and their constraints/indexes, then clear
`_prisma_migrations` and mark the baseline as applied:

```bash
psql "$DATABASE_URL" -f packages/db/prisma/upgrades/20261024_rename_clients_employees.sql
psql "$DATABASE_URL" -c 'DELETE FROM "_prisma_migrations";'
cd packages/db && npx prisma migrate resolve --applied 20261024120000_init
```

The app must be stopped during the rename: old and new table names cannot
coexist across a rolling deploy.

### Positive Consequences

- One consistent vocabulary from navigation to database.
- Clean single-baseline migration history for new installs.
- Existing data is preserved by the one-off upgrade path.

### Negative Consequences

- Existing installations need a maintenance window and a manual upgrade step.
- Old MCP tool names and old hostnames stop working immediately.
- Internal service/type names change, producing a large but mechanical diff.

### Links

- ADR 0020: split the workspace into domain apps
- One-off upgrade: `packages/db/prisma/upgrades/20261024_rename_clients_employees.sql`
- Runbook: `docs/operations/rename-clients-employees.md`
