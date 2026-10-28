# Extend clients into the CRM core

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-14

## Context and Problem Statement

The CRM roadmap (companies, contacts, a sales pipeline, activities and a
company/contact timeline) overlaps with data the workspace already holds. Since
the time & attendance module, a `Client` record exists (name, contact email,
active flag) and projects link to it through `project.clientId`. The CRM must
add company profiles, contacts, pipelines, deals, custom fields and activity
timelines without forking client data into a second, competing model.

## Decision Drivers

- One source of truth: a company referenced by projects (billing, time
  tracking) must be the same record the CRM edits.
- The existing HR/agency workflow (client list, project link) must keep
  working while the CRM grows on top of it.
- Cascades and soft-delete semantics must stay predictable for both modules.
- Keep migrations additive so existing rows survive untouched.

## Considered Options

- A new `Company` model for the CRM, with `Client` kept for billing.
- Extend `Client` in place and hang CRM relations off it.
- Move the CRM into a separate service/database.

## Decision Outcome

Chosen option: "Extend `Client` in place and hang CRM relations off it".

`Client` gains the CRM columns (`status`, `industry`, `website`, `phone`,
`address`, `description`, `source`, `ownerId`, `customFields: Json?` and
`deletedAt` for soft delete) while keeping its original billing fields
(`isActive`, project relation). New models added by migration
`20261014063755_crm_core`:

- `Contact` with a many-to-many `ContactCompany` join (a contact can work with
  several companies; one link is marked primary).
- `Pipeline` and `PipelineStage` (stages carry an `open | won | lost` type that
  drives deal status and forecasts). A default pipeline is lazily seeded the
  first time the CRM is opened.
- `Deal` with `DealContact` many-to-many contacts, probability, expected/actual
  close dates and a `position` for kanban ordering within a stage.
- `CrmActivity` (note | call | email | meeting) linked to any combination of
  company, contact and deal; record timelines merge activities with
  `AuditLog` entries.
- `CrmFieldDefinition` for per-entity custom fields; values are stored as JSON
  on each record keyed by the definition's stable `key`.

Server code lives in `lib/crm/` (repository/service/access/schemas) with
`actions/crm.ts`, pages under `[orgSlug]/(crm)` (`/clients`, `/contacts`,
`/deals`), UI in `components/crm/`, and MCP tools in `lib/mcp/tools/crm.ts`.
Access follows the organization roles: viewer = read-only, member = create and
edit records, admin = pipelines and custom fields.

### Positive Consequences

- Projects, time tracking and the CRM share one company record; renaming a
  client in the CRM updates billing views too.
- Soft delete (`deletedAt`) keeps deals/companies recoverable and avoids
  breaking `project.clientId` references.
- Audit trail entries ("who moved which deal when") come for free from the
  existing `AuditLog` table.

### Negative Consequences

- `Client` now mixes a billing flag (`isActive`) and a CRM lifecycle
  (`status`); UI must explain both, and they must not be conflated.
- Company names stay unique per organization (a pre-existing constraint), so
  the CRM reports a conflict instead of storing near-duplicates; imports must
  treat existing names as skips rather than errors.
- Deals reference pipelines with `onDelete: SetNull`, so deleting a pipeline
  must be blocked while it still has deals (enforced in the service).
