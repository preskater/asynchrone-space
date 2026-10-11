# Use Next.js App Router with React 19

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk needs a framework that delivers server-rendered, authenticated product
surfaces (calendars, projects, files, messages) plus API route handlers for
uploads, MCP, and auth, all from one deployable. Which rendering framework
should the web application be built on?

## Decision Drivers

- Server-rendered, authenticated routes with nested, per-organization layouts.
- API route handlers colocated with the app for uploads, auth, and MCP.
- Streaming and Suspense for responsive navigation; a `loading.tsx` exists per
  feature route.
- First-class support for MDX (marketing/blog content) and React Server
  Components.
- A standalone production server that can be containerized.

## Considered Options

- Next.js App Router (React Server Components).
- Next.js Pages Router.
- A separate client SPA with an independent API server.

## Decision Outcome

Chosen option: "Next.js App Router (React Server Components)", because it
unifies server rendering, layouts, route handlers, and streaming in a single
framework and produces a self-contained server output for Docker.

The app uses the `[locale]` and `[orgSlug]` dynamic segments for i18n and
multi-tenancy, route handlers under `app/api/*` and `app/mcp/route.ts`, and
`output: "standalone"` in `next.config.ts`.

### Positive Consequences

- Route groups (`(app)`, `(marketing)`) give distinct authenticated and public
  surfaces sharing per-locale layouts.
- Route handlers replace a separate API service, reducing operational surface.
- Streaming with Suspense is enabled by default; `loading.tsx` boundaries exist
  for each feature route.

### Negative Consequences

- Server Components and Client Components must be reasoned about carefully; the
  `"use client"` boundary is a recurring source of review discussion.
- Heavy server-only dependencies (e.g. `pg`, `pg-large-object`) must be marked
  as `serverExternalPackages` to avoid bundling issues.
- Framework upgrade cadence is dictated by Next.js releases.

## Pros and Cons of the Options

### Next.js App Router

- Good, because layouts, route handlers, and streaming are unified.
- Good, because `output: "standalone"` yields a minimal production server.
- Bad, because the Server/Client Component split adds cognitive overhead.

### Next.js Pages Router

- Good, because the mental model is simpler and widely documented.
- Bad, because nested layouts and streaming are less ergonomic.
- Bad, because it is on a deprecation path relative to the App Router.

### Separate SPA with an independent API server

- Good, because frontend and backend can scale and deploy independently.
- Bad, because it doubles deploy targets and requires cross-service auth.
- Bad, because server rendering and colocation benefits are lost.

## Links

- `apps/web/next.config.ts`
- `apps/web/app/[locale]/**`
- `apps/web/app/api/**`
