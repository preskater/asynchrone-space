# Contributing to Presk

Thanks for your interest in improving Presk! This document explains how to set
up the project, make changes, and submit them.

By participating you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Ways to contribute

- Report bugs or request features using our
  [issue templates](https://github.com/preskater/presk/issues/new/choose).
- Improve docs (see the [documentation template](https://github.com/preskater/presk/issues/new/choose)).
- Submit a pull request for an open issue. Issues labelled
  [`good first issue`](https://github.com/preskater/presk/labels/good%20first%20issue)
  and [`help wanted`](https://github.com/preskater/presk/labels/help%20wanted)
  are great starting points.
- Review pull requests and join [discussions](https://github.com/preskater/presk/discussions).

## Prerequisites

- **Node.js** >= 20.9.0 (see `engines` in `package.json`).
- **npm** 11 (declared via `packageManager`; run `corepack enable` to match).
- **Docker** (recommended) for a local PostgreSQL instance, or your own
  PostgreSQL 18 server.

## Setup

1. **Fork and clone** the repository, then install dependencies from the repo
   root:

   ```bash
   npm install
   ```

2. **Start PostgreSQL.** The quickest option is Docker:

   ```bash
   docker compose up -d postgres
   ```

   (If you already run PostgreSQL locally, skip this and point `DATABASE_URL`
   at it instead.)

3. **Configure environment variables.** Copy the example file and fill in the
   values:

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

   At minimum, set `DATABASE_URL` and a `BETTER_AUTH_SECRET` (any random
   string). An `OPENAI_API_KEY` is only needed for AI assistant features.

4. **Apply database migrations and generate the Prisma client:**

   ```bash
   npm run generate --workspace=web
   npx prisma migrate deploy --schema apps/web/prisma/schema.prisma
   ```

5. **Run the app:**

   ```bash
   npm run dev
   ```

   The web app is available at http://localhost:3000.

## Project structure

This is a [Turborepo](https://turborepo.com) monorepo managed with npm
workspaces.

| Path | Description |
| --- | --- |
| `apps/web` | Next.js application (App Router, i18n, API + MCP routes). |
| `packages/ui` | Shared UI component library. |
| `packages/eslint-config` | Shared ESLint configuration. |
| `packages/typescript-config` | Shared TypeScript configuration. |

## Scripts

Run these from the repository root; Turborepo fans them out to the relevant
workspaces.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev servers in watch mode. |
| `npm run build` | Build all workspaces. |
| `npm run lint` | Lint all workspaces. |
| `npm run typecheck` | Type-check all workspaces. |
| `npm run format` | Format with Prettier. |

> **Note:** there is currently no automated test suite. Please verify your
> change manually and describe the steps you followed in your pull request.

## Making a change

1. Create a branch off `main` with a descriptive name, e.g.
   `feat/bulk-task-actions` or `fix/calendar-timezone`.
2. Make your change, keeping it focused, and follow the existing code style
   (see `.prettierrc` and `.eslintrc.js` / workspace `eslint.config.js` files).
3. Run the checks before pushing:

   ```bash
   npm run lint && npm run typecheck && npm run build
   ```

4. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
   prefixes (`feat:`, `fix:`, `docs:`, `chore:`, …), matching the existing git
   history.
5. Open a pull request against `main` and fill out the template. Link the issue
   it addresses (e.g. `Closes #123`).

We aim to review pull requests within a few business days. `main` is protected:
changes land through pull requests once CI passes.

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities. See
[SECURITY.md](./SECURITY.md) for how to report them privately.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
