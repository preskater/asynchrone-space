# Upgrade an existing database to the Clients/Employees schema

The migration history was squashed into a fresh baseline
(`20261024120000_init`). New installations apply it with
`prisma migrate deploy`. An existing database must run the one-off rename
script once, then mark the baseline as applied.

The app must be stopped: old code reads `crmActivity`/`hrProfile`, new code
reads `clientActivity`/`employeeProfile`, so they cannot run together.

## 1. Back up

```bash
kubectl -n presk exec deploy/postgres -- \
  pg_dump -U preskater -Fc preskater > presk-before-clients-employees.dump
```

## 2. Stop the apps

Keep PostgreSQL running; scale every app Deployment to zero.

```bash
kubectl -n presk scale deploy presk-web presk-control-tower \
  presk-projects presk-calendars presk-files presk-messages \
  presk-crm presk-hr presk-portal presk-copilot --replicas=0
```

## 3. Rename the tables

```bash
kubectl -n presk exec -i deploy/postgres -- \
  psql -U preskater -d preskater -v ON_ERROR_STOP=1 \
  < packages/db/prisma/upgrades/20261024_rename_clients_employees.sql
```

The script renames `crmActivity`, `crmFieldDefinition`, `crmDocument`,
`hrProfile` and `hrSettings`, plus their PK/FK constraints and indexes, and
rewrites denormalized audit entity names.

## 4. Replace the migration history with the baseline

```bash
kubectl -n presk exec deploy/postgres -- \
  psql -U preskater -d preskater -c 'DELETE FROM "_prisma_migrations";'

kubectl -n presk port-forward svc/postgres 55432:5432 &
cd packages/db
DATABASE_URL='postgresql://preskater:<password>@localhost:55432/preskater?schema=public' \
  npx prisma migrate resolve --applied 20261024120000_init
```

Verify that the resulting schema matches the repository:

```bash
DATABASE_URL='...' npx prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

`No difference detected.` is the expected output.

## 5. Deploy and scale up

```bash
helm dependency build charts/presk
helm upgrade --install presk charts/presk -n presk \
  -f charts/presk/values.local.yaml   # or your production values

kubectl -n presk rollout status deploy/presk-web
kubectl -n presk rollout status deploy/presk-clients
kubectl -n presk rollout status deploy/presk-employees
```

Old `presk-crm`/`presk-hr` resources are removed by the chart upgrade. Old
`crm.*`/`hr.*` hostnames are not served; `/hr` on the employees host redirects
to `/employees`.
