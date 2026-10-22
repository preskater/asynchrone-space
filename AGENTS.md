# Agents

## Repository

- Turborepo + npm workspaces monorepo. Apps: `apps/web` (package `web`, the customer SaaS, Next.js 16 App Router, React 19) and `apps/control-tower` (package `control-tower`, internal platform administration). Shared packages: `packages/db` (`@workspace/db`), `packages/ui` (`@workspace/ui`), `packages/eslint-config`, `packages/typescript-config`.
- Run tasks from the repo root through Turbo: `npm run dev|build|lint|typecheck|format`. Target one workspace with `--workspace=web` / `--workspace=control-tower` (or `-w`).
- `main` is protected: land changes via PR. The `ci` job (`.github/workflows/turbo.yml`) runs typecheck → lint → build; `.github/workflows/helm.yml` lints and renders the chart.

## Verify before finishing

- There is no automated test suite and no `test` script — do not add one speculatively.
- Run, in order: `npm run lint && npm run typecheck && npm run build` (matches CI).
- The Turbo `generate` task (`prisma generate` → `packages/db/lib/generated/prisma`) is a dependency of `build`/`typecheck`/`dev`. After editing `schema.prisma`, run `npm run generate --workspace=@workspace/db`.
- Manual storage check (needs a live DB): `npm run verify:large-object --workspace=web`.
- Manual repository-sync check (needs a live DB; exercises GitHub/GitLab against an in-process mock): `npm run verify:repository-sync --workspace=web`.
- Manual authorization check (needs a live DB; replays the issue #40 cross-org/impersonation attacks): `npx tsx scripts/verify-authorization.ts` (from `apps/web`).
- Control-tower auth invariant (no DB needed): `npm run verify:auth-config --workspace=control-tower`. It fails if cross-subdomain cookies are enabled, sign-up is opened, the web secret is reused, or the 2FA plugin is missing.
- Manual platform-authorization check (needs a live DB): `npm run verify:platform-authorization --workspace=control-tower`. It covers role resolution, the IP allowlist and single-use handoff claims.

## Environment & data

- Env lives in `apps/web/.env` (Next loads it from the app cwd; `packages/db/prisma.config.ts` loads it explicitly, falling back to a package-local `.env`). Start from `apps/web/.env.example`. `CONTROL_TOWER_URL` (the control tower origin) is used by the "Stop impersonating" flow.
- The control tower has its own `apps/control-tower/.env` (`apps/control-tower/.env.example`): `DATABASE_URL`, `BETTER_AUTH_URL` (its own origin), `CONTROL_TOWER_BETTER_AUTH_SECRET` (≥32 chars, different from `BETTER_AUTH_SECRET`), `PLATFORM_APP_URL` (the customer app's origin).
- `docker compose` loads `apps/web/.env` into the `web` container (its `environment` block still overrides `DATABASE_URL`/`BETTER_AUTH_URL`), so local dev and Docker share `BETTER_AUTH_SECRET`; rotating that secret breaks the encrypted JWKS rows in the DB — clear the `jwks` table to regenerate them.
- One `Dockerfile` builds either app with `--build-arg APP=web|control-tower`; `docker compose` serves the customer app on 3002 and the control tower on 3001. `.dockerignore` excludes `.env` files at any depth — never bake local secrets into an image.
- `generate` and `build` require `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` to be set; CI and Docker use non-connecting placeholders.
- When adding an env var, also add it to the `env` arrays in `turbo.json` (build + dev) so Turbo passes it through, update `.env.example`, and add a build-time placeholder in `Dockerfile` / `.github/workflows/turbo.yml` if it is read at build time.
- `DATABASE_POOL_MAX` defaults to `3`. One shared `pg.Pool` in `packages/db/src/prisma.ts` serves both Prisma and the large-object code; `apps/web/lib/prisma.ts` only re-exports it.

## Deployment

- `.github/workflows/docker.yml` publishes three GHCR images: `presk` (web runner), `presk-control-tower` (control-tower runner) and `presk-migrate` (Dockerfile `migrate` stage).
- Helm charts live in `charts/`: `presk` is the umbrella (migration hook and production values), `presk-web` and `presk-control-tower` are the app subcharts. Install/upgrade from the root with `helm dependency build charts/presk` then `helm upgrade --install presk charts/presk -n presk --set global.imageTag=sha-…`.
- The chart requires the existing Secrets `presk-web-secrets` (DATABASE_URL, BETTER_AUTH_SECRET, CRON_SECRET, optional provider keys) and `presk-control-tower-secrets` (DATABASE_URL, CONTROL_TOWER_BETTER_AUTH_SECRET). Never put secrets in values or templates.
- The pre-install/pre-upgrade `presk-migrate` Job runs `prisma migrate deploy`; the web subchart owns the two CronJobs that replaced the former Vercel crons. See `docs/deployment/helm.md` and ADR 0019.
- Verify chart changes with `helm dependency build charts/presk && helm lint --strict charts/presk --set global.imageTag=test && helm template presk charts/presk --set global.imageTag=test`.

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
- Schema and migrations live in `packages/db/prisma`; apply with `cd packages/db && npx prisma migrate deploy`. Create migrations from `packages/db`.
- `@workspace/db` validates only database env (`DATABASE_URL`, `DATABASE_POOL_MAX`). App-specific requirements stay in each app's own `lib/env.ts`.
- File bytes are stored as PostgreSQL large objects in the same DB as metadata — no external object store (Vercel Blob was removed). See `apps/web/lib/large-object.ts`.

## Control tower

- Internal app at `apps/control-tower` (port 3001). Platform roles live in the comma-separated `user.role`: `platform_admin` (full) and `platform_support` (read-only for now). Grant one with `npm run grant:platform-role --workspace=control-tower -- --email you@example.com`; the account must then enroll a TOTP device at `/setup-2fa`.
- Every platform role requires TOTP (`twoFactor` plugin; `TwoFactor` table and `user.twoFactorEnabled`). `requirePlatformContext()` redirects unenrolled operators to `/setup-2fa` and rejects server actions; `requirePlatformSession()` is the 2FA-free variant used only by that page.
- Optional `PLATFORM_ALLOWED_IPS` (comma-separated IPv4/CIDR or `*`) restricts the control tower to known networks as defense in depth. Unset allows every address; in-app auth still applies.
- Its Better Auth instance is deliberately separate: own secret, own host-only cookie (`presk-control-tower.session_token`), sign-up disabled, no `jwt`/`mcp`/`organization` plugins. **Never enable `advanced.crossSubDomainCookies`** — see ADR 0018 and `verify:auth-config`.
- Pages guard with `requirePlatformContext()`; anonymous users go to `/sign-in`, signed-in users without a platform role get `notFound()`. Server actions use `requirePlatformContext({ surface: "action" })` / `withPlatformAction`.
- Platform mutations write `PlatformAuditEvent` rows (never the org-scoped `AuditLog`). Impersonation uses the single-use `PlatformHandoff` table, not a shared cookie.
- Platform mutations are server actions under `apps/control-tower/actions/`. Each uses `withPlatformAction`, enforces `platform_admin` for destructive changes (`platform_support` may revoke sessions), appends a `PlatformAuditEvent`, and revalidates the affected path.
- Impersonation is a single-use handoff, never a shared cookie: the control tower stores a hashed token in `PlatformHandoff` and redirects to `${PLATFORM_APP_URL}/api/platform/handoff?token=…`; the web route claims it, creates a 1-hour session with `impersonatedBy`, and signs its own cookie. `apps/web/app/[locale]/(app)/layout.tsx` shows the banner and deletes the session once it is an hour old; `/api/platform/stop-impersonating` deletes it and returns to `CONTROL_TOWER_URL`.
- `apps/web/lib/auth.ts` registers the same `admin()` plugin (roles map + `adminRoles: ["platform_admin"]`) so bans apply to customer sign-in.

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
