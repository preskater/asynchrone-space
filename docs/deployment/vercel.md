# Deploying to Vercel

Presk deploys as **two independent Vercel projects** from the same repository.
Each project is rooted at its application directory and reads that app's
`vercel.json`.

| Project | Root Directory | Domain | Preview deployments |
| --- | --- | --- | --- |
| `presk` | `apps/web` | `https://presk.re` | enabled |
| `presk-control-tower` | `apps/control-tower` | `https://control-tower.presk.re` | production only (skipped via `ignoreCommand`) |

Both apps share the database and the `packages/db` / `packages/ui` workspaces.
Vercel must include files outside the Root Directory in the build (the default
when a workspace lockfile is detected at the repository root).

## Project settings

For **both** projects:

- **Framework preset**: Next.js (also declared in `vercel.json`).
- **Install Command**: `npm ci` (from `vercel.json`).
- **Build Command**: `npm run generate --workspace=@workspace/db && npm run build`
  (from `vercel.json`). The Prisma client must be generated before
  `next build`; `@workspace/db` owns the schema and generated client.
- **Node.js**: 22.x (project setting → General → Node.js Version). The root
  `package.json` requires `>=20.9.0`.
- **Root Directory**: the app directory listed above. Do not deploy the
  repository root.
- **Production branch**: `main`.
- Never commit `.vercel/` (already gitignored).

### Domains and DNS

- Web: apex `presk.re` on the `presk` project. There is no `www` host; do not
  add one (the web session cookie is host-scoped to `presk.re`).
- Control tower: `control-tower.presk.re` on the control-tower project
  (CNAME to `cname.vercel-dns.com`).
- The two apps deliberately do **not** share cookies. See
  [ADR 0018](../adr/0018-control-tower-on-shared-database-package.md).

### Crons

Crons are declared in `apps/web/vercel.json` only:

| Path | Schedule |
| --- | --- |
| `/api/files/uploads/sweep` | `0 3 * * *` |
| `/api/cron/repository-sync` | `0 * * * *` |

Set `CRON_SECRET` on the web project so Vercel authenticates the cron requests.
The control tower has no crons.

### Preview deployments

- **Web**: previews stay enabled for UI review. If you need working sign-in on a
  preview, point the Preview environment's `BETTER_AUTH_URL` at a stable preview
  alias (or the branch domain); the production origin will not accept preview
  cookies.
- **Control tower**: production only. `apps/control-tower/vercel.json` contains:

  ```json
  "ignoreCommand": "if [ \"$VERCEL_ENV\" != \"production\" ]; then exit 0; fi; exit 1"
  ```

  Vercel skips the build when the command exits `0`, so non-production
  deployments are skipped. This avoids preview auth origins and prevents a
  preview from ever opening a production impersonation session.

## Environment variables

Use the **same database** for both projects. Secrets are project-scoped; the
control tower needs its own Better Auth secret.

### `presk` (web)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | production PostgreSQL URL |
| `DATABASE_POOL_MAX` | `3` (or sized for your pooler) |
| `BETTER_AUTH_SECRET` | existing web secret (32+ chars) |
| `BETTER_AUTH_URL` | `https://presk.re` |
| `NEXT_PUBLIC_APP_URL` | `https://presk.re` |
| `CONTROL_TOWER_URL` | `https://control-tower.presk.re` |
| `CRON_SECRET` | random bearer token |
| `MCP_RESOURCE_URL` | optional; defaults to `https://presk.re/mcp` |
| `OPENAI_API_KEY`, `OPENAI_API_URL`, `ASSISTANT_MODEL` | optional AI features |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | optional repository linking |
| `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET` | optional repository linking |
| `RESEND_API_KEY`, `EMAIL_FROM`, `REQUIRE_EMAIL_VERIFICATION` | email delivery |

OAuth callback URLs are `https://presk.re/api/auth/callback/github` and
`https://presk.re/api/auth/callback/gitlab`.

### `presk-control-tower`

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | same database as web |
| `DATABASE_POOL_MAX` | `3` |
| `BETTER_AUTH_URL` | `https://control-tower.presk.re` |
| `CONTROL_TOWER_BETTER_AUTH_SECRET` | separate random secret (32+ chars) |
| `PLATFORM_APP_URL` | `https://presk.re` |
| `PLATFORM_ALLOWED_IPS` | optional comma-separated IPv4/CIDR allowlist |

Do **not** set `BETTER_AUTH_SECRET` or the MCP/OAuth variables here: the control
tower does not register those plugins and must not need the web signing key.

## First deploy checklist

1. Create the control-tower project, import the repository, set the Root
   Directory to `apps/control-tower`, add the domain, and set the environment
   variables above.
2. Confirm the existing web project's Root Directory is `apps/web` and that its
   environment variables match the web table.
3. Deploy both. Vercel reads `vercel.json`; the build runs `prisma generate`
   before `next build`.
4. Smoke checks:
   - `GET https://presk.re/api/health` → `200`
   - `GET https://control-tower.presk.re/robots.txt` → `User-Agent: *` /
     `Disallow: /`
   - Sign in to the control tower with a `platform_admin` account → TOTP setup
     (first time) → Overview
   - `GET https://presk.re/en/sign-in` → `200`
5. Grant the first platform role locally or from a one-off job:
   `npm run grant:platform-role --workspace=control-tower -- --email you@example.com`.

## Troubleshooting

- **`Cannot find module '../../lib/generated/prisma/client'`**: the build
  command did not generate the Prisma client. Keep
  `npm run generate --workspace=@workspace/db && npm run build`; do not replace
  it with a bare `next build`.
- **Workspace resolution errors**: ensure the project uses the repository root
  for installs and includes files outside the Root Directory.
- **`Failed to decrypt private key`**: `BETTER_AUTH_SECRET` changed. Restore the
  previous secret or clear the `jwks` table to regenerate the MCP signing keys.
