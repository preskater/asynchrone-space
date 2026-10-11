# Use a monorepo with Turborepo and npm workspaces

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk is a web application plus a shared UI component library and shared
tooling (ESLint and TypeScript configurations). These packages are developed
together, released together, and change in lockstep. How should the code be
organized so that shared code is reused and changes are validated consistently?

## Decision Drivers

- A shared UI library (`@workspace/ui`) must be consumed by the web app during
  development with instant feedback, not through a published package.
- Linting, formatting, type-checking, building, and task caching should be
  configured once at the repository root.
- A single clone, install, and CI pipeline keeps setup and review simple for a
  small team.
- The toolchain must support pruning to a single app for production container
  builds.

## Considered Options

- A monorepo with Turborepo and npm workspaces.
- A polyrepo with one repository per package.
- A single app repository with no package boundaries.

## Decision Outcome

Chosen option: "A monorepo with Turborepo and npm workspaces", because the
packages are versioned and released together, and Turborepo provides a shared
task pipeline with caching while npm workspaces provide dependency hoisting
without an extra package manager.

The root `package.json` declares `apps/*` and `packages/*` as workspaces, and
`turbo.json` defines the `build`, `lint`, `format`, `typecheck`, `dev`, and
`generate` tasks with their dependencies and environment inputs. The web app is
`apps/web`; shared packages are `packages/ui`, `packages/eslint-config`, and
`packages/typescript-config`.

### Positive Consequences

- Shared code lives in one place and is consumed directly via the
  `@workspace/ui` path alias and `transpilePackages`.
- A single `npm run <task>` at the root fans out to every workspace through
  Turborepo, with remote/local caching of task outputs.
- `turbo prune web --docker` produces a minimal install for production images.

### Negative Consequences

- All workspaces share one dependency tree and one lockfile, so version
  conflicts must be resolved centrally.
- CI must understand the Turborepo task graph to avoid rebuilding unchanged
  packages; the pipeline in `.github/workflows/turbo.yml` encodes this.

## Pros and Cons of the Options

### Monorepo with Turborepo and npm workspaces

- Good, because shared packages are edited and consumed with no publish step.
- Good, because task orchestration and caching are declarative in `turbo.json`.
- Good, because `turbo prune` supports small production images.
- Bad, because the whole repository is coupled to a single lockfile and
  dependency graph.

### Polyrepo with one repository per package

- Good, because each package has an independent release and access boundary.
- Bad, because cross-package changes require coordinated PRs and version bumps.
- Bad, because local development of the app against the UI library needs
  linking or a publish cycle.

### Single app repository with no package boundaries

- Good, because it is the simplest possible layout.
- Bad, because shared UI and shared config could not be reused or enforced as
  cleanly.

## Links

- `turbo.json`
- Root `package.json` (`workspaces`, `scripts`)
- `apps/web/next.config.ts` (`transpilePackages`)
- `Dockerfile` (`turbo prune web --docker`)
