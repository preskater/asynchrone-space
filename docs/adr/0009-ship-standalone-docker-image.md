# Ship a standalone Docker image with a separate migration service

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk must be deployable reproducibly and runnable locally with its database.
Database migrations must be applied exactly once before the web server serves
traffic, and the production image should be as small as possible and not run as
root. How should the container build and startup sequence be structured?

## Decision Drivers

- Only the web app is needed at runtime; the monorepo must be pruned.
- Migrations must run before the server starts, not on every request.
- Production must not run as root.
- Local development should come up with one command.

## Considered Options

- A multi-stage Dockerfile with `turbo prune`, Next.js `standalone` output, and a
  dedicated `migrate` stage/service.
- A single-stage image that runs migrations then the server in one process.
- Deploying without containers (platform build + release command).

## Decision Outcome

Chosen option: "A multi-stage Dockerfile with `turbo prune`, `standalone`
output, and a dedicated `migrate` stage", because it produces a minimal runtime
image while separating one-time migrations from the long-running server.

The Dockerfile has `base`, `prepare` (`turbo prune web --docker`), `builder`
(build-time placeholder env, `turbo build`), `migrate` (`prisma migrate deploy`),
and `runner` (copies `.next/standalone`, static assets, and public, runs as the
non-root `nextjs` user). `docker-compose.yml` runs `postgres`, then `web-migrate`
to completion, then `web`.

### Positive Consequences

- The runtime image contains only the traced standalone server, static assets,
  and public files.
- Migrations run as an explicit, one-shot service gated on a healthy database,
  not during request handling.
- The process runs as a non-root user.
- `docker compose up --build` brings up a fully migrated stack locally.

### Negative Consequences

- Build-time placeholder values for `DATABASE_URL`, `BETTER_AUTH_SECRET`, and
  `BETTER_AUTH_URL` are required because `prisma generate` and `next build`
  evaluate them; real values must be injected at runtime.
- The runtime image relies on Next.js `output: "standalone"` tracing staying
  correct; missing traced files break the container.
- Compose pins a specific Postgres image and dev credentials, which must not be
  reused in production.

## Pros and Cons of the Options

### Multi-stage Dockerfile with a separate migrate service

- Good, because the runtime image is minimal and non-root.
- Good, because migrations are a distinct, gated step.
- Bad, because build/release requires placeholder build-time env.

### Single-stage image running migrations then the server

- Good, because there is only one stage and one process to reason about.
- Bad, because the image is larger and migration and serving concerns are
  entangled.

### No containers (platform build plus release command)

- Good, because it leans on the hosting platform's build pipeline.
- Bad, because it is less portable and harder to reproduce locally.

## Links

- `Dockerfile`
- `docker-compose.yml`
- `apps/web/next.config.ts` (`output: "standalone"`)
- `README.md` — "Getting started"
