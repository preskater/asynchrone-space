# Add a control-tower app on a shared database package

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-22

## Context and Problem Statement

Presk ships a single customer-facing application (`apps/web`) whose permissions are
organization-scoped only (`Member.role`: `owner | admin | member | viewer | client`).
There is no platform/super-admin surface, so the founders and support team cannot
inspect organizations, users, storage usage, audit trails or operational health
without querying production directly.

Building that surface raises two coupled questions:

1. Where does it live — inside `apps/web`, or as a second application?
2. How does it read the same database without duplicating or forking the Prisma
   schema that currently lives under `apps/web`?

The schema already anticipates part of this: `User` has the Better Auth
admin-plugin columns (`role`, `banned`, `banReason`, `banExpires`, `lastSeenAt`)
and `Session.impersonatedBy`, although the `admin()` plugin is not registered.

## Decision Drivers

- **Blast radius.** Platform-admin code must not be reachable from a customer
  session, a customer bundle, or a customer deploy.
- **One schema.** Two copies of `schema.prisma` are guaranteed to drift and to
  break on every migration.
- **Session hygiene.** Platform sessions should be shorter-lived and may require
  stronger authentication than customer sessions.
- **Least surprise.** The extraction must not change `apps/web` behaviour; 33
  files import `@/lib/prisma` and none of them should need to change.
- **Incremental delivery.** The admin surface can ship read-only first, with
  mutations and impersonation later.

## Considered Options

1. A route group inside `apps/web` (`/[locale]/(control)`), gated by a platform
   role.
2. A separate app with its own copy of the Prisma schema.
3. A separate app plus a shared `packages/db` workspace package.

## Decision Outcome

Chosen option: **a separate `apps/control-tower` app plus a shared `packages/db`**.

`packages/db` (`@workspace/db`) owns `prisma/schema.prisma`, the migrations,
`prisma.config.ts`, the shared `pg.Pool` + `@prisma/adapter-pg` client and the
generated client (`packages/db/lib/generated/prisma`). It validates only database
env (`DATABASE_URL`, `DATABASE_POOL_MAX`); each app keeps its own environment
validation. `apps/web/lib/prisma.ts` becomes a re-export shim that also preserves
the web app's fail-fast env check, so existing import sites are untouched.

A second app is deployed as its own Vercel project rooted at
`apps/control-tower` and its own Docker image, because the customer app's layout
(organization context, seven data loaders) and its bundle are the wrong shell for
an internal tool.

### Sessions and cookies

The control tower uses its **own** Better Auth instance, its own
`CONTROL_TOWER_BETTER_AUTH_SECRET`, its own sign-in, and a host-only session
cookie with `advanced.cookiePrefix: "presk-control-tower"`.

`advanced.crossSubDomainCookies` stays **disabled**. With the customer app on
`https://presk.re` and the control tower on `https://control-tower.presk.re`, a
`Domain=.presk.re` cookie would be transmitted to every current and future
`*.presk.re` host (including vendor-hosted subdomains and their logs), would let
any subdomain shadow the cookie, and would forfeit the `__Host-` cookie prefix.
The only feature that would benefit from a shared cookie — impersonation — is
implemented instead as an explicit, single-use, audited handoff
(`PlatformHandoff`, 60-second TTL) that creates a `Session` row with
`impersonatedBy` and shows a banner in the customer app.

### Positive Consequences

- Platform-admin code, dependencies and deploy settings are isolated from the
  customer app.
- There is exactly one schema, one migration history and one connection pool.
- The shim keeps the extraction mechanical: no behaviour change in `apps/web`.
- A future change to platform session policy (shorter TTL, step-up 2FA, IP
  allowlist) does not affect customer sessions.

### Negative Consequences

- Operators sign in separately to the control tower. If that becomes friction,
  the fix is upstream SSO (Cloudflare Access / Google Workspace) rather than
  widening the cookie domain.
- The monorepo gains a package, a second build target and a second Docker image;
  CI must build both.
- Enabling the Better Auth `admin()` plugin in `apps/web` adds `/api/auth/admin/*`
  routes there. It must be configured with `adminRoles: ["platform_admin"]` and
  verified by `scripts/verify-platform-authorization.ts`.

### Links

- Issue: [#61](https://github.com/preskater/presk/issues/61)
- Migration history: `packages/db/prisma/migrations`
- Web shim: `apps/web/lib/prisma.ts`
