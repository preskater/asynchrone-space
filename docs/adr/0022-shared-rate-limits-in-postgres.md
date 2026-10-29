# Share rate limits through PostgreSQL

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-29

## Context and Problem Statement

The customer app limited requests with an in-memory `Map` per process. On the
Helm deployment ([ADR 0019](0019-deploy-on-kubernetes-with-helm.md)) every
replica kept its own counters, so a limit multiplied with the replica count and
reset on every rollout, and Better Auth's own limiter (memory by default) left
sign-in, sign-up and password reset without effective brute-force protection.
Where should shared counters live? (Issue #90.)

## Decision Drivers

- One counter per key across every replica.
- No new infrastructure to provision, secure, back up and monitor.
- Atomic increments, so concurrent requests cannot all pass a stale read.
- An explicit choice between failing open and failing closed per call site.

## Considered Options

- PostgreSQL, the database every replica already shares.
- Redis (self-hosted or managed, e.g. Upstash), as suggested in the issue.
- The ingress controller's or a WAF's rate limiting only.

## Decision Outcome

Chosen option: **PostgreSQL**. One `rateLimit` table backs both limiters:

- Better Auth uses it with `rateLimit.storage: "database"` and per-path rules
  for `/sign-in/*`, `/sign-up/*`, `/request-password-reset` and
  `/send-verification-email`, keyed by client IP (`X-Real-IP`, set by
  ingress-nginx). Better Auth increments atomically and prunes expired rows.
- `apps/web/lib/core/rate-limit.ts` keeps `app:`-prefixed fixed-window rows,
  incremented with one `INSERT … ON CONFLICT … RETURNING`. Callers pass
  `failOpen`: cosmetic limits (feedback, upload sessions) fail open, limits on
  paid or email-sending actions (assistant runs, invitations) fail closed.
  App windows are capped at Better Auth's longest window (1 h) so its pruning
  never deletes an open window.

Sign-up abuse is handled alongside: Cloudflare Turnstile on sign-up and password
reset (Better Auth `captcha` plugin, enabled when `TURNSTILE_SECRET_KEY` is
set), a disposable-domain blocklist and an optional invitation-only mode in a
`user.create.before` database hook that covers OAuth sign-ups too.

### Consequences

- Good: no new service; local development and every environment work with
  the database they already have, so there is no separate in-memory fallback.
- Good: counters survive rollouts and are shared by every replica.
- Bad: each limited request costs one database round trip and a row write. At
  the current traffic this is negligible next to the request's own queries;
  revisit with Redis if limiter writes show up in database load.
- Bad: if the database is down, fail-closed limits deny requests — but those
  requests could not have been served without the database anyway.
