# Deploying Presk with Helm

Presk runs as two Next.js apps backed by one PostgreSQL database. This guide
installs both from the umbrella chart in `charts/presk`.

```
charts/
  presk/                 # umbrella: dependencies, migration hook, values
  presk-web/             # customer shell: auth, marketing, settings, MCP
  presk-control-tower/   # internal platform app, ingress
  presk-app/             # generic domain app, instantiated per alias
```

## Prerequisites

- A Kubernetes cluster (1.27+) with an ingress controller. The values default
  to the `nginx` ingress class.
- Helm 3.14+ or Helm 4.
- A PostgreSQL database reachable from the cluster.
- `kubectl` access to the target namespace.
- Pull access to the GHCR images. If the packages are private, create an image
  pull secret and pass it through `global.imagePullSecrets`:

  ```bash
  kubectl -n presk create secret docker-registry ghcr-pull \
    --docker-server=ghcr.io \
    --docker-username=<github-user> \
    --docker-password=<github-token>
  ```

  Then reference it in values (strings are normalized to `{ name: … }`):

  ```yaml
  global:
    imagePullSecrets:
      - ghcr-pull
  ```

## Images

`.github/workflows/docker.yml` publishes one image per app for every push to `main`
and every `v*` tag:

| Image | Built from | Purpose |
| --- | --- | --- |
| `ghcr.io/preskater/presk` | `runner` stage, `APP=web` | Customer app |
| `ghcr.io/preskater/presk-control-tower` | `runner` stage, `APP=control-tower` | Control tower |
| `ghcr.io/preskater/presk-projects` … `presk-copilot` | `runner` stage, `APP=<domain>` | Domain apps |
| `ghcr.io/preskater/presk-migrate` | `migrate` stage, `APP=web` | One-shot Prisma migrations |

The workflow tags images with the branch, the release tag and `sha-<shortsha>`.
Use the immutable `sha-` tag:

```bash
helm upgrade --install presk charts/presk -n presk \
  --set global.imageTag=sha-abc1234
```

`global.imageTag` is required; the chart fails to render without it. A
per-subchart `image.tag` overrides it if the apps must roll separately.

## Create the secrets

The chart references existing Secrets and never renders secret values. Create
them before installing; the migration Job and the pods fail fast if a required
key is missing.

```bash
kubectl create namespace presk

kubectl -n presk create secret generic presk-web-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@db:5432/presk?schema=public' \
  --from-literal=BETTER_AUTH_SECRET='<at-least-16-chars>' \
  --from-literal=CRON_SECRET='<random-token>'

kubectl -n presk create secret generic presk-control-tower-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@db:5432/presk?schema=public' \
  --from-literal=CONTROL_TOWER_BETTER_AUTH_SECRET='<at-least-32-chars>'
```

Add optional keys to `presk-web-secrets` as needed:

| Key | Used by |
| --- | --- |
| `OPENAI_API_KEY` | Assistant |
| `RESEND_API_KEY` | Verification and password-reset email |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth account linking |
| `GITLAB_CLIENT_SECRET` | GitLab OAuth account linking |

Use different `BETTER_AUTH_SECRET` and `CONTROL_TOWER_BETTER_AUTH_SECRET`
values. Keep `BETTER_AUTH_SECRET` stable: it encrypts the JWKS rows in the
database. If it is rotated, clear the `jwks` table so new keys are generated.

Secret values are injected with `envFrom` at pod start, so restart the
Deployments after changing a Secret:

```bash
kubectl -n presk rollout restart deploy/presk-web deploy/presk-control-tower
```

## Install

The umbrella chart has local `file://` dependencies, so build them first when
installing from a source checkout:

```bash
helm dependency build charts/presk

helm upgrade --install presk charts/presk \
  --namespace presk \
  --set global.imageTag=sha-abc1234
```

`helm dependency build` writes packaged copies to `charts/presk/charts/`
(git-ignored) and creates `Chart.lock`. Run it again after changing either
subchart.

Use `-f my-values.yaml` for production overrides instead of long `--set`
lists. The defaults already target `presk.re` and
`control-tower.presk.re` with the `nginx` ingress class.

## What gets created

| Resource | Name | Notes |
| --- | --- | --- |
| Deployment | `presk-web`, `presk-control-tower`, `presk-<domain>` | 2 replicas by default |
| Service | `presk-web`, `presk-control-tower`, `presk-<domain>` | ClusterIP, port 80 → container 3000 |
| Ingress | one per app | Shell at `presk.re`; domains at `<domain>.presk.re` |
| ConfigMap | one per app | Non-secret runtime config |
| CronJob | `presk-files-uploads-sweep` | `0 3 * * *` |
| CronJob | `presk-projects-repository-sync` | `0 * * * *` |
| Job (hook) | `presk-migrate` | Pre-install and pre-upgrade |
| ServiceAccount | `presk-web`, `presk-control-tower`, `presk-migrate` | Token automount disabled |
| PDB | `presk-web`, `presk-control-tower` | `minAvailable: 1` |

## Configuration

Web values live under `presk-web` and `presk-control-tower` in
`charts/presk/values.yaml`. The most useful overrides:

| Value | Default | Purpose |
| --- | --- | --- |
| `global.imageTag` | `""` (required) | Tag shared by all three images |
| `global.imagePullSecrets` | `[]` | Pull secrets for private GHCR packages |
| `presk-web.replicaCount` | `2` | Customer app replicas |
| `presk-control-tower.replicaCount` | `2` | Control tower replicas |
| `presk-web.ingress.hosts` | `presk.re` | Customer app host(s) |
| `presk-control-tower.ingress.hosts` | `control-tower.presk.re` | Control tower host(s) |
| `*.ingress.className` | `nginx` | Ingress controller class |
| `*.ingress.tls` | `[]` | TLS secret(s) for the hosts |
| `*.config` | see values | Non-secret environment variables |
| `presk-web.cronjobs.*.enabled` | `true` | Toggle each scheduled job |
| `migrate.enabled` | `true` | Toggle the migration hook |

`BETTER_AUTH_URL`, `PLATFORM_APP_URL`, `NEXT_PUBLIC_APP_URL` and
`CONTROL_TOWER_URL` must match the public URLs served by the ingress. The web
app uses `CONTROL_TOWER_URL` for "Stop impersonating"; the control tower uses
`PLATFORM_APP_URL` for impersonation handoff links.

### TLS and DNS

Point both hostnames at the ingress controller's load balancer, then configure
certificates either through cert-manager annotations:

```yaml
presk-web:
  ingress:
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    tls:
      - secretName: presk-tls
        hosts:
          - presk.re
```

or by creating the TLS Secrets yourself. Repeat for
`presk-control-tower`.

### Uploads and proxy limits

The chart sets nginx proxy read/send timeouts to 600 seconds and a body size of
8 MiB. Uploads are chunked, so a single request stays small, but downloads
stream a PostgreSQL large object and can take a while. Increase the timeouts if
your files are very large, and keep the ingress body limit above the 3 MiB
upload chunk.

### Database connections

Each pod opens one pool (`DATABASE_POOL_MAX`, default 10 in the chart). Keep:

```
(shell + control tower + all domain apps replicas) × DATABASE_POOL_MAX
  + migration/cron headroom
```

below the database connection limit, or point `DATABASE_URL` at PgBouncer or a
managed pooler. In-flight uploads and downloads hold one connection each.

### Control tower access

Every platform role requires TOTP. Grant one from a machine with database
access:

```bash
npm run grant:platform-role --workspace=control-tower -- --email you@example.com
```

The operator then enrolls an authenticator at `/setup-2fa`. Set
`PLATFORM_ALLOWED_IPS` in `presk-control-tower.config` to a comma-separated list
of IPv4 addresses/CIDRs (or `*`). The app reads `X-Forwarded-For` and
`X-Real-IP`, so the ingress must be configured to preserve the client address.
For defense in depth, also add an edge allowlist:

```yaml
presk-control-tower:
  ingress:
    annotations:
      nginx.ingress.kubernetes.io/whitelist-source-range: "203.0.113.0/24"
```

## Migrations

The `presk-migrate` Job is a Helm `pre-install,pre-upgrade` hook with a lower
hook weight than the Deployments. It runs `cd packages/db && npx prisma migrate
deploy` with `DATABASE_URL` from `presk-web-secrets`. A failed migration aborts
the release before pods roll; the Job is kept for inspection:

```bash
kubectl -n presk logs job/presk-migrate
```

The previous hook Job is deleted before the next install/upgrade. To apply
migrations manually (for example when recovering a cluster):

```bash
kubectl -n presk create job presk-migrate-manual \
  --image=ghcr.io/preskater/presk-migrate:sha-abc1234
```

The migrate image runs as a non-root user with a read-only root filesystem and
`HOME=/tmp`. If a future Prisma release needs to write elsewhere, override
`migrate.podSecurityContext` / `migrate.securityContext` in a values file.

## Scheduled jobs

The two CronJobs replace the former Vercel crons and call the owning app
Service. Both send `Authorization: Bearer $CRON_SECRET`, read from
`presk-web-secrets`; the corresponding route rejects a missing/incorrect token
when `CRON_SECRET` is set. `concurrencyPolicy: Forbid` prevents overlapping
runs. Change schedules through `presk-files.cronjobs.uploadsSweep.schedule` or `presk-projects.cronjobs.repositorySync.schedule`.

## Upgrades and rollback

```bash
helm upgrade presk charts/presk -n presk \
  --reuse-values \
  --set global.imageTag=sha-def5678

helm history presk -n presk
helm rollback presk 1 -n presk
```

`--reuse-values` keeps earlier overrides but does not merge new chart defaults;
use `-f my-values.yaml` on every upgrade for a durable configuration. A
rollback also re-runs the migration Job, so rollbacks across a schema-changing
release still need a database plan.

## Verify

```bash
helm lint --strict charts/presk --set global.imageTag=ci
helm template presk charts/presk -n presk --set global.imageTag=ci
kubectl -n presk get pods,svc,ingress,cronjob,job
helm test presk -n presk
kubectl -n presk logs deploy/presk-web --tail=100
```

`helm test` runs the per-subchart connection Pods against each Service.

## Troubleshooting

- **`image.tag or global.imageTag must be set`** — pass `--set
  global.imageTag=sha-…`; the chart intentionally refuses to default to a
  mutable tag.
- **Migration Job fails immediately** — check that the Secret exists and
  contains `DATABASE_URL`; check the Job logs. If Prisma needs a writable path,
  set `migrate.securityContext.readOnlyRootFilesystem=false`.
- **Pods crash with `Invalid environment configuration`** — a required
  variable is missing or malformed. Compare the ConfigMap and Secret with the
  env table in the README.
- **Pods start but the control tower returns 404** — the account has no platform
  role; grant it and enroll TOTP.
- **Client IPs are the ingress address** — configure the controller to preserve
  `X-Forwarded-For` (nginx: `use-forwarded-headers: "true"`).
- **CronJob fails with `secret not found`** — `CRON_SECRET` is missing from
  `presk-web-secrets`; the chart mounts it as a required key.
- **Read-only filesystem errors** — Next.js writes its image cache to
  `apps/<app>/.next/cache`, mounted as an `emptyDir`. If a custom runtime path
  is used, override `cache.mountPath` or
  `securityContext.readOnlyRootFilesystem`.

## Local Docker Desktop cluster

`charts/presk/values.local.yaml` deploys the whole workspace to the Docker
Desktop Kubernetes cluster. It uses:

- the local Docker daemon's images (`presk:local`, `presk-<app>:local`,
  `presk-control-tower:local`);
- HTTP ingress disabled in favour of HTTPS on `*.lvh.me` (resolves to
  `127.0.0.1` for every app);
- the in-cluster `postgres` service and the existing `presk-web-secrets` /
  `presk-control-tower-secrets`;
- `migrate.enabled: false`, because migrations are applied from the host.

Build the images from the working tree:

```bash
for app in web control-tower projects calendars files messages crm hr portal copilot; do
  image="presk"
  [ "$app" != "web" ] && image="presk-$app"
  docker build --build-arg APP="$app" -t "$image:local" .
done
```

Create the wildcard TLS secret used by every ingress:

```bash
openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout /tmp/lvh.key -out /tmp/lvh.crt \
  -subj '/CN=*.lvh.me' \
  -addext 'subjectAltName=DNS:lvh.me,DNS:*.lvh.me,DNS:presk.lvh.me,DNS:*.presk.lvh.me'
kubectl -n presk create secret tls presk-lvh-tls \
  --cert=/tmp/lvh.crt --key=/tmp/lvh.key
```

Apply the new migrations from the host (the Postgres Service is not exposed
outside the cluster):

```bash
kubectl -n presk port-forward svc/postgres 55432:5432 &
cd packages/db
DATABASE_URL='postgresql://preskater:<password>@localhost:55432/preskater?schema=public' \
  npx prisma migrate deploy
```

Deploy or upgrade:

```bash
helm dependency build charts/presk
helm upgrade --install presk charts/presk -n presk \
  -f charts/presk/values.local.yaml
```

The apps are then available at:

| App | URL |
| --- | --- |
| Shell | `https://presk.lvh.me` |
| Projects | `https://projects.presk.lvh.me` |
| Calendars | `https://calendars.presk.lvh.me` |
| Files | `https://files.presk.lvh.me` |
| Messages | `https://messages.presk.lvh.me` |
| CRM | `https://crm.presk.lvh.me` |
| HR | `https://hr.presk.lvh.me` |
| Portal | `https://portal.presk.lvh.me` |
| Copilot | `https://copilot.presk.lvh.me` |
| Control tower | `https://control-tower.presk.lvh.me` |

The certificate is self-signed, so browsers warn once per host. Copilot chat
needs `OPENAI_API_KEY` in `presk-web-secrets`; every app already mounts that
Secret.
