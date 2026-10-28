# Deploy on Kubernetes with Helm

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-22

## Context and Problem Statement

Asynchrone Space was deployed to Vercel as two app-rooted projects, with `vercel.json`
files supplying the build command and two Vercel Cron schedules. The project
already ships standalone Docker images ([ADR 0009](0009-ship-standalone-docker-image.md)),
and those images are the intended production artifact. How should the customer
app and the control tower be deployed reproducibly to an environment the team
controls?

## Decision Drivers

- Keep one portable deployment artifact instead of depending on a hosted
  platform's build, cron, analytics and request-body limits.
- Deploy both apps from the same monorepo images built by CI.
- Run Prisma migrations exactly once before new pods serve traffic.
- Replace Vercel Cron with scheduler jobs that call the same guarded routes.
- Keep secrets out of source control, values files and Helm release state.
- Preserve the separate Better Auth instances and host-only cookies of the two
  apps.

## Considered Options

- Deploy with Helm to Kubernetes, using an umbrella chart and one subchart per
  app.
- Stay on Vercel with the app-rooted projects and `vercel.json`.
- Deploy with raw Kubernetes manifests or Kustomize.
- Deploy with Docker Compose on a single host.

## Decision Outcome

Chosen option: "Deploy with Helm to Kubernetes", because the project already
produces standalone images and Kubernetes gives explicit control over
migrations, scheduling, secrets, ingress and rolling updates.

`charts/asynchrone-space` is an umbrella chart with `asynchrone-space-web` and `asynchrone-space-control-tower`
subcharts. The customer app owns the two CronJobs that replace the Vercel crons.
The umbrella chart owns a `pre-install,pre-upgrade` Job that runs
`prisma migrate deploy` from the dedicated `asynchrone-space-migrate` image. Both apps read
configuration from ConfigMaps and secrets from existing Kubernetes Secrets
(`asynchrone-space-web-secrets` and `asynchrone-space-control-tower-secrets`); the chart never renders
or stores secret material. One `global.imageTag` pins the three images built by
`.github/workflows/docker.yml`.

This replaces the implicit Vercel deployment configuration (`vercel.json`, the
Vercel analytics packages and the Vercel deployment documentation). No prior ADR
recorded the Vercel decision; ADR 0009 remains valid and describes the images
that Helm deploys.

### Positive Consequences

- The deployment is portable across clusters and does not depend on a hosted
  platform's build or cron product.
- Migrations are a gated, one-shot step before either Deployment rolls out.
- Ingress timeouts and body limits are explicit and can exceed serverless caps.
- Secrets stay in the cluster; they are never committed or stored in the Helm
  release.
- One image tag rolls the web app, control tower and migration image together.

### Negative Consequences

- The team operates a cluster, ingress controller, TLS certificates and image
  pull credentials.
- `helm dependency build` is required before linting or installing the umbrella
  chart from source.
- The migration Job runs as the only long-lived privileged-ish workload; its
  security context may need adjusting if Prisma starts writing outside `$HOME`.
- Cron schedule changes require a `helm upgrade` instead of editing a hosted
  dashboard.

## Pros and Cons of the Options

### Helm on Kubernetes

- Good, because images, migrations, cron jobs, services and ingress live in one
  reviewable release.
- Good, because the same chart works locally (kind/minikube) and in production.
- Bad, because it adds cluster and chart-maintenance overhead.

### Stay on Vercel

- Good, because there is no cluster to operate.
- Bad, because the deployment is tied to Vercel-specific config, crons and
  analytics, and the project already targets portable container images.

### Raw manifests or Kustomize

- Good, because there is no templating layer.
- Bad, because environment overrides, migration hooks and reusable subcharts
  would be hand-rolled.

### Docker Compose on a single host

- Good, because it is close to the existing local setup.
- Bad, because it does not provide scheduling, rolling updates, ingress or
  multi-replica health management.

## Links

- `charts/asynchrone-space` — umbrella chart, migration hook and production values
- `charts/asynchrone-space-web` — customer app, ingress and CronJobs
- `charts/asynchrone-space-control-tower` — internal app and ingress
- `.github/workflows/docker.yml` — `asynchrone-space`, `asynchrone-space-control-tower` and
  `asynchrone-space-migrate` images
- `.github/workflows/helm.yml` — chart lint/render CI
- [ADR 0009](0009-ship-standalone-docker-image.md) — standalone Docker images
- `docs/deployment/helm.md` — installation and operations guide
