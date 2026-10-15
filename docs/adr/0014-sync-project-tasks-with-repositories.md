# Sync project tasks with GitHub/GitLab repositories

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-15

## Context and Problem Statement

User feedback (issue #47): IT teams live in their repositories and their issue
trackers. Round-tripping between Presk and GitHub/GitLab to check or file work
loses time, and statuses drift apart. The workspace needs a repository
connected to a project such that issues and tasks stay in sync both ways:

- existing issues are imported as tasks and existing tasks are reported as
  issues;
- edits on either side propagate;
- closing/reopening an issue mirrors the task status and vice versa (done);
- a pull/merge request linked to an issue moves the task "For Review", and
  moving a task to review opens a draft PR.

The same feature must work for GitHub, GitLab, and their self-managed
variants, without adding new infrastructure.

## Decision Drivers

- One sync engine: provider and API differences (issue vs. `iid`, HMAC vs.
  token verification, PR vs. MR) must not duplicate the workflow logic.
- Immediate setup: connecting a repository should need one token, not
  deploying an OAuth app first. User-attributed writes are a plus, not a
  prerequisite.
- Local operations must never fail because a provider is down or rate
  limited; remote failures surface in explicit sync runs instead.
- Security: credentials encrypted at rest and webhook payloads verified
  against a per-connection secret.
- Conflicts: GitHub/GitLab cannot provide a shared revision we can lock on;
  field-level merges or three-way diffs are out of scope.

## Considered Options

- **A: Provider-specific sync modules.** Each provider gets its own
  task↔issue logic. Fast initially, but every workflow fix must land twice and
  the self-managed variants multiply the paths.
- **B: Generic integration framework** (plugins, event bus, connectors for
  many tools). Premature; there is exactly one integration family today.
- **C: Normalized provider adapters + one sync engine** (chosen). Two REST
  clients implement the same small interface (`RepositoryApi`); the sync
  engine, hooks and webhooks are provider-agnostic.
- **OAuth-only authentication.** Forces every workspace to register OAuth
  apps before the feature works; rejected. Per-project token is the base,
  optional linked user accounts are preferred when present.

## Decision Outcome

Chosen option: **C**, with a project-scoped connection and a per-request token
strategy.

- `RepositoryConnection` (one per project, one repo per organization) stores
  provider, instance URL for self-managed hosting, owner/repo, an access token
  **encrypted with AES-256-GCM** keyed from `BETTER_AUTH_SECRET`, and a
  generated webhook secret. Projects keep working after disconnect; task links
  remain as history.
- `Task` gains `externalIssueNumber/Url`, `externalPrNumber/Url` and
  `externalUpdatedAt` (staleness guard: older payloads never overwrite newer
  local state, and repeated webhook deliveries converge).
- Adapters (`lib/integrations/providers`) implement
  `getRepository/listIssues/createIssue/updateIssue/createPullRequest` with
  `fetch`, plus webhook verification/parsing. GitHub uses HMAC-SHA256
  (`X-Hub-Signature-256`); GitLab compares `X-Gitlab-Token`.
- The sync engine (`lib/integrations/sync.ts`) is used by three entry points:
  **connect backfill** (import open issues, push tasks without a link),
  **webhooks** at `/api/webhooks/repositories/<connectionId>`, and a
  **manual "Sync now" / hourly cron** (`/api/cron/repository-sync`) as the
  safety net when webhooks are not reachable.
- Task hooks from `ProjectService` are best effort (errors logged, local write
  wins); connect/sync surface provider errors to the user.
- Status mapping: closed issue ⇔ `done` task; reopening moves a done task back
  to `todo`. Moving a task to `review` (or a PR opening against its issue)
  links a draft PR/MR created from a `presk/<issue>-<slug>` branch with a
  marker commit (`.presk/<identifier>.md`), including `Closes #<issue>` so
  merging closes the issue and completes the loop.
- Accounts: GitHub/GitLab OAuth apps are optional (`GITHUB_CLIENT_ID`/…).
  A linked user's token is preferred for their actions so issues/PRs are
  authored by them; the project token covers webhooks, cron and unlinked
  users.

### Positive Consequences

- A project is connected with one PAT — no OAuth app or webhook tunnel needed
  to start; webhooks can be added later and cron keeps things close before
  that.
- Both directions of every acceptance rule live in one engine; adding a
  provider (e.g. Gitea) means implementing one adapter.
- Tokens are encrypted and never leave the server; webhook payloads are
  verified per connection.

### Negative Consequences

- Conflict resolution is last-writer-wins; concurrent edits of the same field
  can flap until one side pauses (the staleness guard limits but does not
  eliminate this).
- Webhooks need a publicly reachable deployment; without them sync quality
  depends on the cron cadence.
- Rotating `BETTER_AUTH_SECRET` invalidates stored connection tokens; the
  connection must be reconnected with a fresh token.
- GitHub Enterprise and GitLab subgroups are supported via adapter mappings,
  but unusual setups (custom issue templates, multi-project issue boards)
  stay out of scope.
