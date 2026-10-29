# Use server actions as the only CRUD transport

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-16

## Context and Problem Statement

The app grew two parallel transports that exposed the same services: REST route
handlers under `app/api/*` backed by controllers in `lib/*/controller.ts`, and
server actions in `actions/*` backed by the same services. Client components
only ever called the server actions (or client-side better-auth for auth); the
REST CRUD routes existed for parity and were exercised by tests, not by the
product. Every new capability had to be wired twice — request parsing, zod
validation, error serialisation — and the two paths could drift (schemas,
role guards, cache revalidation) with nothing forcing them to agree.

Some capabilities genuinely need an HTTP route handler because a server action
cannot serve them: streaming responses (the assistant), raw-byte transfers
(chunked uploads, downloads), third-party callbacks (webhooks) and scheduled
jobs (cron).

## Decision Drivers

- One write path per capability: validation, authorization and revalidation
  live once, in the service + server action that the UI actually uses.
- Removing dead code: ~29 REST CRUD routes and 4 controllers duplicated the
  actions, including helpers (`handle()`, `readJson()`) that existed only for
  them.
- Non-negotiables: streaming, upload, download, webhook, cron and auth
  endpoints must keep working over plain HTTP.
- The programmatic/agent surface already exists: the OAuth2-protected MCP
  endpoint (ADR 0006) is the API for external callers, not REST.

## Considered Options

- **A: Keep both transports.** Continued drift and double maintenance; nothing
  consumes the REST CRUD routes.
- **B: Remove the REST CRUD routes and controllers; keep only the HTTP routes
  that server actions cannot replace.** The UI keeps using server actions; MCP
  stays the programmatic API.

## Decision Outcome

Chosen option: **B**.

- Deleted the CRUD route handlers (`calendars`, `conversations`, `events`,
  `files` metadata, `labels`, `members`, `messages`, `projects`,
  `task-templates`, `tasks`) and the controller modules
  (`lib/files/controller.ts`, `lib/projects/controller.ts`,
  `lib/messaging/controller.ts`, `lib/calendars/controller.ts`), along with the
  now-unused `handle()` route wrapper and `readJson()` helper.
- Kept route handlers for the cases server actions cannot serve:
  `/api/assistant` (streaming), `/api/files/uploads/*` (chunked upload,
  ADR 0010), `/api/files/[fileId]/download`, `/api/messages/attachments/*`,
  `/api/portal/documents/upload`, `/api/portal/files/[fileId]/download`,
  `/api/auth/*` (better-auth), `/api/webhooks/repositories/*`,
  `/api/cron/repository-sync` and `/api/health`.
- E2E specs that used the removed routes now drive the same service guards
  through the UI (project member self-removal, cross-organization project
  reads).

### Positive Consequences

- Each capability has exactly one in-app transport; validation and
  authorization are shared by the remaining callers (server actions and MCP
  tools call the same services).
- The REST surface is small and each remaining route has a concrete reason to
  exist (streaming, bytes, callbacks, cron).

### Negative Consequences

- External integrations can no longer use REST CRUD; they must go through MCP,
  or a dedicated route handler must be (re)introduced if a real consumer
  appears.
- The two e2e security checks now depend on UI flows instead of direct HTTP
  calls, so they are a little more coupled to component markup.
