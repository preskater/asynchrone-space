# syntax=docker/dockerfile:1

ARG NODE_VERSION=26.10.0
ARG ALPINE_VERSION=3.24
ARG WORKDIR=/usr/src/presk

# ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base
ARG WORKDIR
WORKDIR ${WORKDIR}
ENV NEXT_TELEMETRY_DISABLED=1

# ---
FROM base AS prepare
COPY . .
RUN npx turbo prune web --docker

# ---
FROM base AS builder
ARG WORKDIR
# Install dependencies first (they change less often than source)
COPY --from=prepare ${WORKDIR}/out/json/ .
RUN npm ci
# Build the project
COPY --from=prepare ${WORKDIR}/out/full/ .

# Build-time placeholders. `prisma generate` loads prisma.config.ts, which
# requires DATABASE_URL, and `next build` evaluates auth config. Neither
# connects to the database during the build. Real values are injected at
# runtime (e.g. `docker run -e DATABASE_URL=... -e BETTER_AUTH_SECRET=...`).
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV BETTER_AUTH_SECRET=build-placeholder-secret-not-used-at-runtime
ENV BETTER_AUTH_URL=http://localhost:3000

# Uncomment and pass build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM
# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

RUN npx turbo build

# ---
# Applies pending Prisma migrations, then exits. Runs before `web` starts.
# Reuses the pruned dependency install + source from `prepare`. The schema and
# migrations live in `packages/db` (shared with the control tower).
FROM base AS migrate
ARG WORKDIR
COPY --from=prepare ${WORKDIR}/out/json/ .
RUN npm ci
COPY --from=prepare ${WORKDIR}/out/full/ .
CMD ["sh", "-c", "cd packages/db && npx prisma migrate deploy"]

# ---
FROM node:${NODE_VERSION}-alpine AS runner
ARG WORKDIR
WORKDIR ${WORKDIR}
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Don't run production as root for security reasons
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output
COPY --from=builder --chown=nextjs:nodejs ${WORKDIR}/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs ${WORKDIR}/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs ${WORKDIR}/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
