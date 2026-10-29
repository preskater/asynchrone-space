# Rename the product to Asynchrone Space

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-28

## Context and Problem Statement

The product was built and shipped as **Presk** on `presk.re` (with `presk.app`
used in marketing, legal and workspace URLs). Every technical identifier followed
that name: the npm package, Helm charts, Kubernetes resources, GHCR images,
Better Auth cookies, browser storage keys, repository branch prefixes and
generated export filenames.

The product is now branded **Asynchrone Space** on `asynchrone.space`. The
legal entity and GitHub owner remain **Preskater**. Leaving the old name in
identifiers would keep two vocabularies alive: operators, docs and users would
have to translate between "Presk" and "Asynchrone Space" on every surface.

Which identifiers change, which stay, and what happens to existing state?

## Decision Drivers

- One name everywhere: user-facing copy, docs, domains and code identifiers.
- Keep the legal entity (`Preskater`) and the GitHub/GHCR owner unchanged so
  repository history, ownership and image registry access are preserved.
- Avoid silently breaking stored credentials or live sessions without saying so.
- Keep DNS and Kubernetes names predictable and DNS-safe.

## Considered Options

- **Full clean rename.** Rename every user-facing and technical identifier,
  including stateful ones, with no legacy fallbacks.
- **Preserve stateful identifiers.** Keep the token-encryption salt, branch
  prefixes and storage keys while renaming everything else, adding
  compatibility for old values.
- **Branding only.** Change copy, docs and domains but leave all technical
  identifiers as `presk*`.

## Decision Outcome

Chosen option: **Full clean rename**, because it leaves a single vocabulary and
the project has no production data that cannot be re-created by re-linking an
account.

- Product name: **Asynchrone Space** (prose and UI).
- Technical slug: **`asynchrone-space`** (package, charts, Kubernetes resources,
  images, cookies, storage keys, exports).
- Domains and mailboxes: `presk.re`, `presk.app` and
  `control-tower.presk.re` become `asynchrone.space`,
  `control-tower.asynchrone.space` and `@asynchrone.space`.
- Legal structure: **Preskater** stays in `LICENSE`, `.github/CODEOWNERS` and
  the `ghcr.io/preskater/...` image namespace.
- Stateful identifiers change with no fallback:
  - Better Auth control-tower cookie prefix `asynchrone-space-control-tower`.
  - Browser keys `asynchrone-space.appearance.user.*` and
    `asynchrone-space.recents.v2`.
  - Repository branch prefix `asynchrone-space/<issue>-…` and marker file
    `.asynchrone-space/<identifier>.md`.
  - Token key-derivation salt `asynchrone-space:repository-token:`.

## Consequences

- Every platform operator signs in again: the control-tower session cookie is
  renamed.
- Every stored GitHub/GitLab repository token becomes undecryptable (the
  key-derivation salt changed). Users re-link their account or paste a fresh
  personal access token.
- Per-user appearance and recent-item preferences reset once.
- Previously auto-created pull/merge requests still resolve through the
  `Closes #<n>` fallback in their body; branches matched only by the old
  `presk/<n>` prefix are no longer recognized.
- Kubernetes cannot upgrade the renamed chart in place: deploy a fresh
  `asynchrone-space` namespace and Secrets, cut DNS over, then remove the old
  release. GHCR publishes new `asynchrone*` images on the next `main`
  build.
- Historical references in earlier ADRs are rewritten to the new name; this
  record documents the rename itself.

## Links

- [ADR 0018](0018-control-tower-on-shared-database-package.md) — control-tower
  cookie isolation that the renamed cookie prefix preserves.
- [ADR 0019](0019-deploy-on-kubernetes-with-helm.md) — chart layout and
  migration hook that the renamed charts follow.
