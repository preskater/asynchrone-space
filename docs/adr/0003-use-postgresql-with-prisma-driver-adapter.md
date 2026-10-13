# Use PostgreSQL with Prisma 7 and the pg driver adapter

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk stores relational domain data (organizations, members, projects, tasks,
calendars, messages, files) and also streams binary file bytes from the same
database using PostgreSQL large objects. The application runs on serverless
platforms where each instance has a low, fixed database connection budget. How
should the data layer be configured so that Prisma and the large-object code
share connections safely without exhausting the database?

## Decision Drivers

- One database for relational metadata and file bytes avoids a second storage
  system and cross-system consistency problems.
- Serverless instances must cap connections per instance to avoid `P2037 /
TooManyConnections`.
- Prisma and the raw `pg`-based large-object helpers must use the same pool;
  Prisma disposing the pool would break large-object operations.
- A single client must survive hot reloads and warm invocations.

## Considered Options

- Prisma 7 with the `@prisma/adapter-pg` driver adapter over a shared `pg.Pool`.
- Prisma with the default (non-adapter) connection handling.
- A separate ORM/client, or raw SQL only.

## Decision Outcome

Chosen option: "Prisma 7 with the `@prisma/adapter-pg` driver adapter over a
shared `pg.Pool`", because the adapter lets Prisma and the large-object helpers
share one explicitly sized pool that is never disposed by Prisma.

`lib/prisma.ts` builds one `Pool` with `max` from `DATABASE_POOL_MAX` (default
`3`), configures timeouts, and passes it to
`new PrismaPg(pool, { disposeExternalPool: false })`. Both the pool and the
`PrismaClient` are cached on `globalThis` for warm invocations and hot reloads.

### Positive Consequences

- Prisma and large-object reads/writes reuse one pool, so connection usage is
  predictable and bounded per instance.
- The pool size is tunable with a single environment variable.
- The singleton pattern avoids connection leaks across HMR and warm starts.

### Negative Consequences

- Pointing `DATABASE_URL` at a pooler (PgBouncer, Neon, Supabase) is strongly
  recommended in production; without one, concurrency can still exhaust the
  role's connection limit.
- Long file transfers hold a pooled connection for their duration, competing
  with normal Prisma traffic when many transfers run at once.
- The adapter is a required dependency and adds a layer to reason about during
  upgrades.

## Pros and Cons of the Options

### Prisma with `@prisma/adapter-pg` over a shared pool

- Good, because the pool is shared with raw `pg` code and is never disposed by
  Prisma.
- Good, because `max` is explicitly set for serverless environments.
- Bad, because production correctness depends on an external pooler.

### Prisma with default connection handling

- Good, because it is the simplest setup.
- Bad, because the default pool (`max: 10`) per instance exhausts connection
  limits on serverless platforms.
- Bad, because it cannot share a pool with the large-object helpers.

### Raw SQL only

- Good, because it gives full control over every query and connection.
- Bad, because migrations, type-safety, and query ergonomics are lost.

## Links

- `apps/web/lib/prisma.ts`
- `apps/web/lib/large-object.ts`
- `apps/web/prisma/schema.prisma`
- [ADR-0005](0005-store-files-as-postgresql-large-objects.md) — consumes this pool
