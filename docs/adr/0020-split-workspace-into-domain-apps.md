# Split the customer workspace into domain apps

- Status: proposed
- Deciders: Presk maintainers
- Date: 2026-10-23

## Context and Problem Statement

`apps/web` serves every product surface from one Next.js runtime: projects, tasks,
calendars, meetings, files, messages, CRM, HR and the client portal. Each surface
already lives in its own folders (`lib/<domain>`, `components/<domain>`,
`actions/<domain>.ts`, `app/[locale]/(app)/[orgSlug]/<domain>`), but they share:

- one workspace layout that eagerly loads projects, calendars, files, messages,
  notifications and appearance into client providers;
- one sidebar/header that reads the project and messaging stores;
- one build, one deployment and one failure domain.

A bug or a slow loader in one surface can take down the whole workspace, and
teams cannot ship or scale a surface independently.

## Decision Drivers

- **Independent delivery.** Ship and scale projects, calendars, files, messages,
  CRM, HR, portal and Copilot separately.
- **Blast radius.** A regression in one surface must not take down the others.
- **Shared truth.** One database, one Prisma schema, one auth system, one UI kit.
- **Incremental migration.** Keep `apps/web` working while surfaces move out one
  at a time.
- **Reuse.** The portal, the MCP endpoint, global search and the Copilot all need
  the same domain logic; it cannot stay app-local.

## Considered Options

1. Keep the modular monolith and extract packages only.
2. Separate apps served under path prefixes behind one ingress.
3. Separate apps on subdomains, sharing packages, database and session.

## Decision Outcome

Chosen option: **separate deployable Next.js apps on subdomains**, sharing
`@workspace/db`, `@workspace/ui`, the new shared packages and the customer
session.

Apps and hosts:

| App | Host | Owns |
| --- | --- | --- |
| `apps/web` | `presk.re` | Marketing, auth/OAuth, onboarding, org selection, settings, help, feedback, search, MCP, platform handoff, shared shell |
| `apps/projects` | `projects.presk.re` | Projects, tasks, templates, repository sync |
| `apps/calendars` | `calendars.presk.re` | Calendars, events, meeting requests |
| `apps/files` | `files.presk.re` | Files, uploads, versions, shares |
| `apps/messages` | `messages.presk.re` | Conversations and attachments |
| `apps/crm` | `crm.presk.re` | Clients, contacts, pipelines, deals |
| `apps/hr` | `hr.presk.re` | Profiles, attendance, leave, salary |
| `apps/portal` | `portal.presk.re` | Client portal |
| `apps/copilot` | `copilot.presk.re` | AI chat and call copilot |
| `apps/control-tower` | `control-tower.presk.re` | Unchanged internal administration |

Each app keeps the `/{locale}/{orgSlug}/...` path shape. Domain logic moves into
`@workspace/<domain>` packages with `./server`, client-safe and `./ui` exports so
the shell, portal, MCP and Copilot can consume it without internal HTTP calls.

The shell (`apps/web`) stays the only auth server and the only app that mounts
`/api/auth`, `/mcp`, OAuth consent and platform handoff.

### Migration

Incremental, one domain at a time:

1. Extract shared runtime packages without behaviour change.
2. Move `projects` end-to-end as the pilot template.
3. Move CRM and HR, then calendars/meetings, files, messages and portal.
4. Add Copilot.
5. Replace per-app Helm charts with a reusable `presk-app` chart.

### Positive Consequences

- Surfaces deploy and scale independently; the shell no longer loads every
  domain's data.
- Domain services have one home and are reused by MCP, portal and Copilot.
- A failure in one app does not affect the others.

### Negative Consequences

- More builds, images, deployments and connection pools. `DATABASE_POOL_MAX`
  must be budgeted across apps (or a pooler introduced).
- Cross-app navigation becomes cross-origin; URLs and redirects must use one
  shared app-URL registry.
- `localStorage` is origin-scoped, so recents and theme do not automatically
  carry across subdomains.
- The monorepo gains packages and a more complex local dev setup.

### Links

- ADR 0021: shared customer sessions across subdomains
- ADR 0022: Copilot app
- ADR 0018: control tower isolation (unchanged)

> **2026-10-24:** The `crm` and `hr` apps were renamed to `clients` and `employees`, including their packages, hosts and database tables. See [ADR 0023](0023-rename-crm-hr-to-clients-employees.md).
