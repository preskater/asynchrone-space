# Split the customer workspace into domain apps

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-31

## Context and Problem Statement

`apps/web` serves the marketing site, authentication, onboarding, every
workspace surface, the client portal, the MCP endpoint and the platform
handoff. The domain code is already separated by folder (`lib/<domain>`,
`components/<domain>`, `actions/<domain>.ts`,
`app/[locale]/(app)/[orgSlug]/<domain>`), but the surfaces still share one
workspace layout that eagerly loads projects, calendars, files, messages,
notifications and appearance, and they share one build, one deployment, one
database and one failure domain.

That coupling means a slow loader, a migration or a regression in one surface
can take down the whole workspace, and a team cannot ship or scale one surface
independently. Issue #77 tracks the split; closed PR #78 is the reference
implementation.

The marketing site also has different requirements from the authenticated
workspace: it is public, stateless and SEO-sensitive, while the workspace needs
a session on every page. Serving both from the same host puts the session cookie
on the marketing origin.

## Decision Drivers

- **Independent delivery.** Ship and scale projects, calendars, files,
  messages, clients and employees separately.
- **Blast radius.** A regression, migration or pool exhaustion in one surface
  must not take down the others.
- **Session isolation.** Every app gets its own session; the landing and control
  tower are outside the customer auth surface.
- **Data ownership.** One app owns one database and one migration history.
- **One identity.** Users, organizations, members, roles and 2FA live in Copilot,
  which is the OAuth 2.1/OIDC authorization server.
- **Incremental migration.** Keep the current app working while surfaces move
  out one at a time.

## Considered Options

1. Keep the modular monolith and extract packages only.
2. Separate apps served under path prefixes behind one ingress.
3. A stateless landing app at the apex plus a Copilot shell and domain apps on
   subdomains, with OIDC sessions and one database per app.

## Decision Outcome

Chosen option: **a stateless landing app at the apex, a Copilot workspace shell
on `copilot.asynchrone.space`, and domain apps nested under
`*.copilot.asynchrone.space`**, sharing `@workspace/ui` and the shared kernel
packages. Copilot is the authorization server (ADR 0029) and every app owns its
database (ADR 0032).

Apps, hosts and databases:

| App                  | Host                                      | Database                   | Owns                                                                                                                                                                                               |
| -------------------- | ----------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/landing`       | `asynchrone.space` (`www` redirects here) | none                       | Marketing, blog, pricing, features, about, careers, contact, FAQ, legal. No session.                                                                                                               |
| `apps/copilot`       | `copilot.asynchrone.space`                | `asynchrone_identity`      | OAuth 2.1/OIDC server, workspace home and assistant, onboarding, organization selection, settings, billing, audit log, search, help, feedback, MCP, platform handoff, client portal, notifications |
| `apps/projects`      | `projects.copilot.asynchrone.space`       | `asynchrone_projects`      | Projects, tasks, templates, repository sync                                                                                                                                                        |
| `apps/calendars`     | `calendars.copilot.asynchrone.space`      | `asynchrone_calendars`     | Calendars, events, meeting requests and settings                                                                                                                                                   |
| `apps/files`         | `files.copilot.asynchrone.space`          | `asynchrone_files`         | Files, uploads, versions, shares, upload sweep, large objects                                                                                                                                      |
| `apps/messages`      | `messages.copilot.asynchrone.space`       | `asynchrone_messages`      | Conversations, threads, attachment metadata                                                                                                                                                        |
| `apps/clients`       | `clients.copilot.asynchrone.space`        | `asynchrone_clients`       | Clients, contacts, pipelines, deals, activities, documents                                                                                                                                         |
| `apps/employees`     | `employees.copilot.asynchrone.space`      | `asynchrone_employees`     | Profiles, attendance, leave, salary, capacity                                                                                                                                                      |
| `apps/control-tower` | `control-tower.asynchrone.space`          | `asynchrone_control_tower` | Internal administration with its own auth and platform audit; reads customer identity through a Copilot internal admin API                                                                         |

There is no separate portal app. Portal routes (`/{locale}/portal/...`) and
portal APIs live in `apps/copilot`, using the Copilot OIDC session. Internal apps
reject `clientId` members.

Workspace apps keep the `/{locale}/{orgSlug}/...` path shape; only the origin
changes. The landing keeps `/{locale}/...`. A single app registry maps an app key
to its environment variable, database and development port, and builds
cross-app links through it. Hosts are runtime configuration, never
`NEXT_PUBLIC_*` values baked into an image.

Domain logic lives in `@workspace/<domain>` packages with server, client-safe
and UI entrypoints, but apps are now **service boundaries**, not just deployment
boundaries. A domain package depends only on its own database package. The
portal, MCP, search and Copilot read other domains through authenticated
`/internal/*` endpoints; there are no cross-database joins and no app imports
another app's Prisma client.

Audit is written per app (ADR 0033): the mutation records its `AuditLog` row in
the same database transaction, and Copilot aggregates the trail through internal
APIs. Export and organization/user deletion are orchestrated sagas in Copilot;
there is no cross-database transaction.

`apps/copilot` is the only app that mounts `/api/auth`, the OAuth/OIDC
endpoints, `/mcp` and the platform handoff. Domain apps are OIDC clients with
host-only sessions and never mount auth. `apps/landing` imports neither the auth
package nor Prisma.

### Migration

Incremental, one package or app per pull request:

1. Record the decisions and add package boundaries plus a feature-parity
   inventory.
2. Rename CRM/HR to Clients/Employees before splitting their databases
   (ADR 0030).
3. Extract the shared kernel (`core`, `auth`, `organization`, `i18n`,
   `app-shell`) without behaviour change.
4. Build the OIDC authorization server and the app OIDC client package
   (ADR 0029).
5. Create the per-app databases, migration job and maintenance-window data split
   (ADR 0032).
6. Add the identity internal API, per-app audit aggregation, export/deletion
   sagas and notification/search contracts (ADR 0033).
7. Extract the marketing routes into `apps/landing` and deploy it at
   `asynchrone.space`.
8. Rename `apps/web` to `apps/copilot`, make it the OAuth server, and keep the
   domain routes there temporarily.
9. Move `projects` end to end as the pilot at
   `projects.copilot.asynchrone.space`.
10. Move calendars, files, messages, clients and employees.
11. Persist Copilot conversations and make Copilot the workspace home
    (ADR 0031).
12. Finalize `apps/landing`, then deploy and harden the fleet.

The branch in PR #78 is the reference, not the merge vehicle: it predates
billing, the trial, customer session management, the audit log, customer 2FA,
data export, Sentry, shared rate limits, organization deletion and the
Asynchrone Space rename.

## Consequences

### Positive

- Surfaces deploy, migrate and scale independently; the shell no longer loads
  every domain's data.
- Each app owns its schema, migrations, pool and backup boundary.
- Tokens are audience-bound; a compromised app cannot use another app's session.
- The landing is stateless and cacheable; the control tower is outside the
  customer auth surface.

### Negative

- More builds, images, deployments and databases. `DATABASE_POOL_MAX` must be
  budgeted per app, or a pooler introduced.
- Cross-domain reads are internal HTTP calls with latency, caching and partial
  failure semantics.
- There is no cross-database transaction; audit, export and deletion are
  eventually consistent sagas.
- OIDC adds redirects, token refresh, JWKS caching, logout handling and client
  secret/key rotation.
- Two wildcard TLS levels are required: `*.asynchrone.space` and
  `*.copilot.asynchrone.space`.
- The landing cannot show personalized auth state without an extra
  cross-origin call.
- Local development and CI must create and migrate several databases and run
  several apps.

## Links

- Issue [#77](https://github.com/preskater/asynchrone-space/issues/77)
- Milestone [#1](https://github.com/preskater/asynchrone-space/milestone/1)
- Reference implementation: PR
  [#78](https://github.com/preskater/asynchrone-space/pull/78)
- [0029](0029-use-copilot-as-oauth-authorization-server.md) — OAuth 2.1 server
  and per-app sessions
- [0030](0030-rename-crm-hr-to-clients-employees.md) — rename before the split
- [0031](0031-add-copilot-app-with-persisted-conversations.md) — Copilot as the
  workspace shell and assistant
- [0032](0032-give-each-app-its-own-database.md) — database per app
- [0033](0033-keep-audit-export-and-deletion-consistent-across-databases.md) —
  cross-database consistency
- [0018](0018-control-tower-on-shared-database-package.md) — control-tower
  isolation
- [0019](0019-deploy-on-kubernetes-with-helm.md) — Kubernetes and Helm
  deployment
