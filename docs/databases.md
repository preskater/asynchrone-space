# Per-app databases

ADR 0032 gives every workspace app its own PostgreSQL database. The target
schemas are generated from the monolith schema by
`scripts/split-prisma-schema.mjs`; the data copy is #185 and the migration
orchestration is #184.

## Packages

| Database                   | Package                       | Owner                                                                                                                    |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `asynchrone_identity`      | `@workspace/db-identity`      | Copilot: users, sessions, organizations, members, OAuth, billing, notifications, assistant, portal, rate limits, exports |
| `asynchrone_projects`      | `@workspace/db-projects`      | Projects, tasks, templates, comments, activity, repository sync                                                          |
| `asynchrone_calendars`     | `@workspace/db-calendars`     | Calendars, events, meeting requests/settings                                                                             |
| `asynchrone_files`         | `@workspace/db-files`         | File nodes, versions, shares, upload sessions, large objects                                                             |
| `asynchrone_messages`      | `@workspace/db-messages`      | Conversations, messages, reactions, attachment metadata                                                                  |
| `asynchrone_clients`       | `@workspace/db-clients`       | Clients, contacts, pipelines, deals, activities, documents                                                               |
| `asynchrone_employees`     | `@workspace/db-employees`     | HR profiles, attendance, leave, settings, salary, internal activities                                                    |
| `asynchrone_control_tower` | `@workspace/db-control-tower` | Platform auth/2FA, platform audit, handoff                                                                               |

`@workspace/db-core` owns the shared pool factory and `DATABASE_POOL_MAX`
validation. `@workspace/db` remains the monolith database until #185.

Every package declares its own `DATABASE_URL` env:

- `IDENTITY_DATABASE_URL`
- `PROJECTS_DATABASE_URL`
- `CALENDARS_DATABASE_URL`
- `FILES_DATABASE_URL`
- `MESSAGES_DATABASE_URL`
- `CLIENTS_DATABASE_URL`
- `EMPLOYEES_DATABASE_URL`
- `CONTROL_TOWER_DATABASE_URL`

All fall back to `DATABASE_URL` for local/CI convenience. Production sets each
explicitly (#192).

## Local development

`docker/postgres/init.sql` creates every database when the compose volume is
initialized:

```bash
docker compose up postgres
```

Existing volumes are not re-initialized. Create missing databases manually with
the same `CREATE DATABASE` statements or reset the volume.

## Generation

The schemas are generated, not hand-edited:

```bash
npm run split:prisma
npm run verify:prisma-schemas
```

`split-prisma-schema.mjs`:

1. reads `packages/db/prisma/schema.prisma`;
2. assigns every model to one database (auth models are duplicated for the
   control tower);
3. removes relation fields that point at another database, keeping the scalar
   `organizationId`/`userId` columns;
4. appends the shared `AuditLog` table to every database;
5. writes each package's `prisma/schema.prisma`, `prisma.config.ts`, client and
   package scaffold.

Change the ownership map or the source model, then regenerate. Do not edit a
generated schema by hand.

## Generate clients

```bash
npm run generate --workspace=@workspace/db-projects
# or through the Turbo graph:
npm run typecheck
```

Each package writes its client to `lib/generated/prisma`. The generated folders
are ignored by ESLint and git.

## Boundaries

- A domain package imports only its own `@workspace/db-<domain>` package.
- No cross-database relation fields or joins. Cross-domain reads use the
  internal APIs from `@workspace/contracts` and `@workspace/service-auth`.
- No cross-database cascades. Organization/user deletion and export are sagas
  (#188).
- Every database gets its own migrations in #184; the current schemas have no
  migration history yet.

## Status

- [x] Per-app packages, schemas and clients (#183)
- [x] Local database creation (#183)
- [x] CI schema validation (#183)
- [ ] Migration orchestration (#184)
- [ ] Maintenance-window data split (#185)
- [ ] App wiring to the per-app clients (#186+)
