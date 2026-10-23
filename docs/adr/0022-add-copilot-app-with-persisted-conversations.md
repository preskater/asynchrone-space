# Add a Copilot app with persisted conversations

- Status: proposed
- Deciders: Presk maintainers
- Date: 2026-10-23

## Context and Problem Statement

The AI assistant is currently a page inside `apps/web` (`/[locale]/[orgSlug]`) with
an ephemeral client-side transcript and a `/api/assistant` route that replays the
client's history. The product direction is a dedicated AI chat and call copilot:
conversations should survive reloads, and later the copilot should capture calls,
transcribe them, summarize them and turn action items into tasks.

## Decision Drivers

- **Product focus.** The assistant needs its own surface and release cadence.
- **Persistence.** Users expect history across devices and reloads.
- **Safety.** The server, not the client, must own the conversation history sent
  to the model.
- **Reuse.** The copilot must read and write projects, calendars, files and
  messages through the same domain packages as the apps.
- **Incremental delivery.** Ship text chat first; call capture is a follow-up.

## Decision Outcome

Chosen option: **a dedicated `apps/copilot` app on `copilot.presk.re` with
persisted conversations**, built in two stages.

### Stage 1 — text copilot (this effort)

- Move `components/assistant`, `lib/assistant` and `/api/assistant` to
  `apps/copilot` and `@workspace/ai`.
- `POST /api/assistant` accepts `{ conversationId?, text }` and loads the history
  from the database. The client no longer replays tool calls.
- New models:

  | Model | Columns |
  | --- | --- |
  | `AssistantConversation` | `id`, `organizationId`, `userId`, `title`, `createdAt`, `updatedAt`, index `(organizationId, userId, updatedAt)` |
  | `AssistantMessage` | `id`, `conversationId`, `role`, `parts` JSON, `createdAt`, index `(conversationId, createdAt)` |

- Each conversation is private to its user in an organization.
- Persist the user message when accepted and the assistant parts when the stream
  completes.
- The shell's organization home redirects to the Copilot app, preserving today's
  "assistant is home" behaviour.

### Stage 2 — call copilot (follow-up)

- Models: `Call`, `CallTranscriptSegment`, `CallSummary`, `CallActionItem`.
- Audio stored as PostgreSQL large objects; transcription runs as a background
  job.
- Provider adapters for browser capture and Google Meet/Teams/Zoom; the meeting
  provider abstraction from `lib/meetings/providers.ts` is the extension point.
- Write-back to projects (tasks), messages and calendars through the domain
  packages.
- Consent, retention and audit policy must be defined before capturing audio.

### Positive Consequences

- Conversation history is durable and server-authoritative.
- The copilot composes domain packages directly and can later create tasks,
  events and messages.
- Call features get a dedicated home instead of bloating the shell.

### Negative Consequences

- Two new tables and a migration.
- Audio capture introduces privacy, consent, retention and provider-contract
  obligations that must be designed separately.

### Links

- ADR 0020: split the workspace into domain apps
- ADR 0006: expose the AI assistant over MCP
