# Use per-user repository tokens for issue and PR authoring

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-15

## Context and Problem Statement

ADR-0014 connected a repository to a project with a single project-level
access token. Every issue and pull request was therefore authored by whoever
owned that token (usually an admin's bot-like credential), and any workspace
member could push to the repository regardless of their own GitHub/GitLab
access. Product feedback (issue #47):

- a user must bring **their own** access token, saved in their profile, so an
  issue created from Presk is automatically linked to them;
- users **without repository access must not be able to create issues**.

## Decision Drivers

- Attribution: remote items must show the acting user as author.
- Authorization: repository permissions already live on GitHub/GitLab — using
  the user's own credential makes the provider the single source of truth.
- No shared long-lived secret stored per repository.
- Background flows (webhooks, cron) must keep working without inventing
  system accounts or restoring a shared token.

## Considered Options

- **A: Keep the project token and prefer a per-user token when present.**
  Rejected: users without a token still bypass repository permissions and
  their issues are silently attributed to the token owner.
- **B: Per-user OAuth tokens only** (linked social accounts). Rejected as the
  only mechanism: the feature would require registering OAuth apps before it
  works at all.
- **C: Per-user personal access tokens stored in the profile**, with a linked
  OAuth account token as fallback (chosen).

## Decision Outcome

Chosen option: **C**.

- New `UserRepositoryToken` model (`userId`, `provider`, encrypted
  `accessToken`, unique per user+provider), managed from
  **Account settings → Repository access**. `RepositoryConnection` no longer
  stores a credential; only the webhook secret remains on it.
- Token resolution for every user-driven provider call: profile token →
  linked OAuth account token → error `repository_user_token_missing` pointing
  at the profile. Provider 401/403/404 responses map to
  `repository_access_denied`.
- **Creating a task is gated**: in a connected project the issue is created
  remotely first; a missing token, denied access, or a provider failure aborts
  the action and no task row is written (`repository_issue_create_failed`,
  502). Status moves (done, review → PR) and deletes push before the local
  write too, so access errors abort them.
- Content edits (title/description) stay local-first with the existing
  debounced, best-effort push: the task panel persists per keystroke, so
  synchronous gating would make typing unusable. Full syncs heal pushes that
  never landed.
- Webhooks need no credential (signature/token verification only, verified
  locally). The hourly cron sync uses the token of whoever connected the
  repository; if that token is gone the connection is skipped and manual
  "Sync now" by any admin with a token still reconciles.

### Positive Consequences

- Issues and pull requests are authored by and linked to the acting user.
- GitHub/GitLab access control decides who can file and modify work; removing
  a user's token revokes their push ability without touching the connection.
- No shared repository secret to rotate; broken credentials produce
  actionable errors instead of silent divergence on create/move/delete.

### Negative Consequences

- Onboarding friction: every contributing user must save a token before they
  can create tasks in repository-connected projects.
- Rotating `BETTER_AUTH_SECRET` invalidates all stored tokens (re-save in the
  profile); the failure is visible as "token missing".
- One token per provider per user: self-managed GitLab / GitHub Enterprise
  instances must be reachable with that same token; per-instance credentials
  would need a schema change.
- Unattended cron sync is delegated to the connecting user's token; if that
  user is removed or revokes it, background pulls stop until an admin runs
  "Sync now" (webhooks keep working regardless).
