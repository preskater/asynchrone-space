# Agents

## Repository

- Turborepo + npm workspaces monorepo. The only app is `apps/web` (package name `web`, Next.js 16 App Router, React 19). Shared packages: `packages/ui` (`@workspace/ui`), `packages/eslint-config`, `packages/typescript-config`.
- Run tasks from the repo root through Turbo: `npm run dev|build|lint|typecheck|format`. Target one workspace with `--workspace=web` (or `-w web`).
- `main` is protected: land changes via PR. The `ci` job (`.github/workflows/turbo.yml`) runs typecheck → lint → build.

## Verify before finishing

- There is no automated test suite and no `test` script — do not add one speculatively.
- Run, in order: `npm run lint && npm run typecheck && npm run build` (matches CI).
- The Turbo `generate` task (`prisma generate` → `apps/web/lib/generated/prisma`) is a dependency of `build`/`typecheck`/`dev`. After editing `schema.prisma`, run `npm run generate --workspace=web`.
- Manual storage check (needs a live DB): `npm run verify:large-object --workspace=web`.

## Environment & data

- Env lives in `apps/web/.env` (Next loads it from the app cwd; `prisma.config.ts` loads it via `dotenv/config`). Start from `apps/web/.env.example`.
- `generate` and `build` require `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` to be set; CI and Docker use non-connecting placeholders.
- When adding an env var, also add it to the `env` arrays in `turbo.json` (build + dev) so Turbo passes it through, update `.env.example`, and add a build-time placeholder in `Dockerfile` / `.github/workflows/turbo.yml` if it is read at build time.
- `DATABASE_POOL_MAX` defaults to `3`. One shared `pg.Pool` in `apps/web/lib/prisma.ts` serves both Prisma and the large-object code.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

<!-- BEGIN:nextjs-agent-rules -->

## Next.js

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Prisma / database

- Prisma 7 with the `@prisma/adapter-pg` driver adapter (not the default connector).
- Migrations live in `apps/web/prisma/migrations`; apply with `npx prisma migrate deploy --schema apps/web/prisma/schema.prisma`. Create migrations from `apps/web`.
- File bytes are stored as PostgreSQL large objects in the same DB as metadata — no external object store (Vercel Blob was removed). See `apps/web/lib/large-object.ts`.

## Code layout & conventions

- Path aliases: `@/*` → `apps/web/*`, `@workspace/ui/*` → `packages/ui/src/*`. UI imports require `transpilePackages` (already set in `next.config.ts`).
- UI is shadcn/ui on **Base UI** primitives (not Radix) with Tailwind. Owned components live in `packages/ui/src/components`.
- `pg` and `pg-large-object` are listed in `serverExternalPackages`; keep them out of client code.
- i18n uses next-intl with `localePrefix: "always"` (en default, fr). Add every user-facing string to both `apps/web/messages/en` and `apps/web/messages/fr`; blog/content MDX is mirrored under `apps/web/content/<type>/<locale>`.
- The assistant/MCP endpoint is at `apps/web/app/mcp/route.ts` (not under `/api`) and is excluded from the i18n middleware in `apps/web/proxy.ts`. Other API routes are under `apps/web/app/api/*`.
- ESLint is flat-config per workspace (`eslint.config.js`); the root `.eslintrc.js` only holds ignores. Prettier config is `.prettierrc` (with Tailwind class sorting); root `format` only covers `**/*.{ts,tsx}`.

## Decisions & process

- Architecture decisions are recorded in `docs/adr/` using MADR. Add a new record instead of editing an accepted one, and update the index in `docs/adr/README.md`.
- Commits use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), matching the existing history.
- The Next.js and Turborepo blocks at the top of this file are regenerated by the tools; keep them committed rather than deleting them in cleanup.
