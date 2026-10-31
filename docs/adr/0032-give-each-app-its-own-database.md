# Give each workspace app its own database

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-31

## Context and Problem Statement

The monolith uses one Prisma schema and one PostgreSQL database for every
surface. ADR 0028 splits the surfaces into apps; ADR 0029 gives each app its own
OIDC session. Keeping one shared database would preserve the hidden coupling the
split is meant to remove: a migration or query in one domain can lock or break
another, and every app needs credentials for every table.

How do apps own their data without turning every cross-domain call into a
distributed transaction?

## Decision Drivers

- **Data ownership.** One app owns one schema and one migration history.
- **Failure isolation.** A migration or connection-pool problem in one app must
  not take down the others.
- **No cross-domain joins.** Cross-domain data comes through an explicit API.
- **Operational simplicity.** One PostgreSQL cluster is acceptable; one cluster
  per app is not.
- **Migration safety.** The existing data must move with a documented,
  reversible maintenance window.
- **Compliance.** Export and deletion must still cover every row and every file.

## Considered Options

1. Keep the shared database and separate only the code.
2. Separate PostgreSQL schemas in one database.
3. Separate PostgreSQL databases in one cluster.
4. One PostgreSQL cluster per app.

## Decision Outcome

Chosen option: **separate PostgreSQL databases in one cluster**, one database per
workspace app.

### Databases and owners

| Database                   | Owner                | Owns                                                                                                                                                                                                                                                     |
| -------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asynchrone_identity`      | `apps/copilot`       | User, session, account, verification, customer 2FA, organization, member, invitation, team, OAuth clients/tokens/consents, subscription, invoices, billing events, assistant conversations, portal invites, notifications, rate limits, data-export jobs |
| `asynchrone_projects`      | `apps/projects`      | Projects, tasks, labels, templates, comments, activity, repository connections, project audit                                                                                                                                                            |
| `asynchrone_calendars`     | `apps/calendars`     | Calendars, events, attendees, meeting requests/settings, calendar audit                                                                                                                                                                                  |
| `asynchrone_files`         | `apps/files`         | File nodes, versions, shares, upload sessions, PostgreSQL large objects, file audit                                                                                                                                                                      |
| `asynchrone_messages`      | `apps/messages`      | Conversations, messages, reactions, attachment metadata, message audit                                                                                                                                                                                   |
| `asynchrone_clients`       | `apps/clients`       | Clients, contacts, pipelines, deals, activities, documents, client audit                                                                                                                                                                                 |
| `asynchrone_employees`     | `apps/employees`     | HR profiles, attendance, leave, balances, settings, salary, employee audit                                                                                                                                                                               |
| `asynchrone_control_tower` | `apps/control-tower` | Platform auth, platform 2FA, platform audit, handoff state                                                                                                                                                                                               |

- Every app has its own Prisma schema, generated client, migration history,
  connection pool, database URL and backup/restore procedure.
- The identity database is the only source of truth for users, organizations,
  members, roles and entitlements. Domain databases store `organizationId` and
  `userId` as opaque strings.
- There are no cross-database foreign keys and no cross-database joins.
- Control tower keeps its own platform auth, 2FA and audit database and reads
  customer users/organizations through a Copilot internal admin API. It never
  queries another app's database.
- File bytes live in `asynchrone_files` as PostgreSQL large objects. Other apps
  store file IDs and fetch metadata or bytes through the files internal API.
- Audit rows live in the database of the app that performs the mutation
  (ADR 0033).

### Access rules

- Cross-database reads and writes happen through `/internal/*` endpoints
  authenticated with OAuth `client_credentials` tokens (ADR 0029).
- `/internal/*` is never exposed through public ingress; Kubernetes
  `NetworkPolicy` or the compose network limits callers.
- A domain package depends only on its own database package. Importing another
  app's Prisma client is a build failure.

### Migration

The split is a deliberate maintenance-window cutover:

1. Freeze writes and snapshot the monolith database.
2. Create the identity and domain databases with their new Prisma baselines.
3. Copy table groups in dependency order, preserving IDs.
4. Re-create file bytes as new large objects in `asynchrone_files` and rewrite
   the stored OIDs.
5. Verify row counts, checksums, relationship samples and large-object sizes.
6. Deploy the new apps and the OAuth server, run smoke tests, then unfreeze.
7. Keep the old database read-only until the rollback window closes.

The per-database baselines are an intentional exception to the “never rewrite
migration history” rule used by the Clients/Employees rename (ADR 0030). The old
monolith history is retired after the cutover.

## Consequences

### Positive

- Each app owns its schema, migrations and pool; failures are isolated.
- Cross-domain access is explicit and auditable.
- Domain databases can be backed up, restored or moved independently.
- A small domain can be scaled or reset without touching identity or files.

### Negative

- No cross-database transactions; export, deletion and audit become sagas or
  fan-outs (ADR 0033).
- Identity and member data must be fetched through an API and cached.
- N databases mean N secrets, N migration steps, N backup/PITR checks and a
  restore order.
- The maintenance window can lose writes made after the cutover if rolled back.
- Existing data must be copied; large objects make the copy slower and riskier.

## Links

- [0028](0028-split-workspace-into-domain-apps.md) — the app split
- [0029](0029-use-copilot-as-oauth-authorization-server.md) — OAuth 2.1 and app
  sessions
- [0033](0033-keep-audit-export-and-deletion-consistent-across-databases.md) —
  cross-database consistency
- [0005](0005-store-files-as-postgresql-large-objects.md) — file bytes as large
  objects
- [0018](0018-control-tower-on-shared-database-package.md) — control-tower
  isolation
