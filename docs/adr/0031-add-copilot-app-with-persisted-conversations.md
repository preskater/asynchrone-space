# Make Copilot the workspace shell with persisted conversations

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-31

## Context and Problem Statement

The AI assistant is currently a page inside `apps/web`
(`/[locale]/[orgSlug]`) with an ephemeral client-side transcript. The
`/api/assistant` route replays the history supplied by the client, so a reload
loses the conversation and the server cannot trust the context it sends to the
model.

ADR 0028 also moves the workspace shell to `copilot.asynchrone.space` and the
public landing site to `asynchrone.space`. That makes Copilot the natural home
for the authenticated product: the assistant, auth, organization settings, the
portal, MCP and the domain-app switcher all live there.

## Decision Drivers

- **Workspace home.** Copilot is the first screen after sign-in and the
  navigation hub for the domain apps.
- **Persistence.** Users expect history across reloads and devices.
- **Safety.** The server, not the client, must own the history sent to the
  model.
- **Reuse.** Copilot must read and write projects, calendars, files and
  messages through the same domain packages as the apps.
- **Incremental delivery.** Ship text chat first; call capture is a separate
  product and privacy decision.

## Considered Options

1. Keep the assistant ephemeral and keep the workspace shell in `apps/web`.
2. Persist conversations inside `apps/web` without moving the shell.
3. Rename the workspace shell to `apps/copilot`, deploy it at
   `copilot.asynchrone.space`, and make the assistant its home surface.

## Decision Outcome

Chosen option: **make `apps/copilot` the workspace shell and the assistant
home**, with persisted conversations built in two stages.

### Shell ownership

- `apps/web` is renamed to `apps/copilot` and deployed at
  `copilot.asynchrone.space`.
- `apps/landing` owns the public marketing site at `asynchrone.space`.
- `apps/copilot` is the OAuth 2.1/OIDC authorization server (ADR 0029) and owns
  auth/2FA, onboarding, organization selection, settings, billing, audit log,
  search, help, feedback, MCP, platform handoff, the client portal and the
  assistant. Its identity database owns users, organizations and members
  (ADR 0032).
- The domain apps live under `*.copilot.asynchrone.space` and are reachable
  from the Copilot navigation.
- `/mcp` stays in `apps/copilot`.

### Stage 1 — text copilot (this milestone)

- Move `components/assistant`, `lib/assistant` and `/api/assistant` into the
  Copilot shell and `@workspace/ai`.
- `POST /api/assistant` accepts `{ conversationId?, text }` and loads the
  history from the database. The client no longer replays tool calls.
- New models:

  | Model                   | Columns                                                                                                          |
  | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
  | `AssistantConversation` | `id`, `organizationId`, `userId`, `title`, `createdAt`, `updatedAt`, index `(organizationId, userId, updatedAt)` |
  | `AssistantMessage`      | `id`, `conversationId`, `role`, `parts` JSON, `createdAt`, index `(conversationId, createdAt)`                   |

- Each conversation is private to its user in an organization.
- Persist the user message when accepted and the assistant parts when the
  stream completes. A failed stream must not corrupt the conversation.
- `apps/copilot` reuses `@workspace/ai`. Assistant tools call the domain apps'
  internal APIs with delegated service tokens instead of importing their
  Prisma clients (ADR 0032).
- Copilot is the organization home, so no extra redirect is needed.

### Stage 2 — call copilot (later)

Call capture, transcription, summaries and action-item write-back are out of
scope for this milestone. They need new models (`Call`,
`CallTranscriptSegment`, `CallSummary`, `CallActionItem`), a background
transcription job, provider adapters and a consent, retention and audit policy
before any audio is captured.

## Consequences

### Positive

- Conversation history is durable and server-authoritative.
- Copilot composes domain packages directly and can later create tasks,
  events and messages.
- The workspace has one home for auth, settings, the portal, MCP and the
  assistant instead of a chat page bolted onto a separate shell.
- The public landing site stays outside the customer session scope.

### Negative

- Two new tables and a migration.
- Renaming `apps/web` to `apps/copilot` touches Docker, CI, Helm, environment
  files and docs.
- Audio capture introduces privacy, consent, retention and provider-contract
  obligations that must be designed separately.

## Links

- Issues [#165](https://github.com/preskater/asynchrone-space/issues/165),
  [#166](https://github.com/preskater/asynchrone-space/issues/166) and
  [#175](https://github.com/preskater/asynchrone-space/issues/174)
- [0028](0028-split-workspace-into-domain-apps.md) — the landing, Copilot shell
  and domain-app split
- [0029](0029-use-copilot-as-oauth-authorization-server.md) — Copilot as the
  OAuth 2.1/OIDC authorization server
- [0032](0032-give-each-app-its-own-database.md) — database per app
- [0006](0006-expose-ai-assistant-over-mcp.md) — the MCP endpoint that stays in
  the Copilot shell
- Reference implementation: PR
  [#78](https://github.com/preskater/asynchrone-space/pull/78)
