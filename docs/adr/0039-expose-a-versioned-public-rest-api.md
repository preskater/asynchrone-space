# 0039. Expose a versioned public REST API with outbound webhooks

- Status: accepted
- Date: 2026-11-10
- Deciders: platform
- Issue: #96

## Context

Customers need to automate their workspace from scripts and third-party
tools. There was no supported way in: the MCP endpoint is OAuth-scoped for
assistants, the portal and internal APIs are session-bound, and server actions
are not a machine interface. Anything a customer built against internal URLs
would break silently.

Outbound events were missing too. Polling the whole workspace is expensive for
both sides, and the existing repository webhooks only serve the projects app's
GitHub/GitLab sync.

The API must not weaken the existing model: one organization per token, the
creator's current role still applies, every mutation is audited, rate limits are
shared, and domain apps keep owning their own databases and authorization
(ADR 0032, ADR 0036).

## Decision

1. **The API lives on the apex at `/api/v1`.** The umbrella chart adds one
   Ingress path from `asynchrone.space` to Copilot rather than a new host: the
   docs are on the landing, there is no second cookie domain, and no new DNS or
   certificate is needed.

2. **Tokens are organization-scoped, hashed, and act as their creator.**
   `ApiToken` (identity database) stores a SHA-256 hash, a display prefix and
   the chosen scopes; the raw `async_` + 32-byte base64url value is returned
   once. Every request re-reads the token row and the creator's membership, so
   revocation, expiry and role changes apply immediately. An optional
   `X-Asynchrone-Organization` header must match the token's organization id or
   slug, never selects another organization. Client-portal accounts are
   rejected. Owners and admins create tokens in Settings → Developers.

3. **Scopes cap what a token can ask for; the domain app still decides.**
   `@workspace/contracts` owns the scope list, the public resource schemas and
   the versioned route manifest. Copilot authenticates the token and delegates
   through `DomainClient` (`/internal/v1/domain/:operation`); projects,
   clients, employees and files re-check the member's role and write the audit
   row with the token as actor (`api-token:<id>`). No route opens another
   app's database.

4. **One envelope for pagination, errors and limits.** List routes use keyset
   cursors (`limit` 1–100, default 50) and return
   `{ data, meta: { nextCursor, requestId } }`. Failures share a stable
   `{ error: { code, message, details? }, meta: { requestId } }` shape. Rate
   limits stay in the shared Postgres limiter (ADR 0022), keyed per token and
   sized by plan (60 / 300 / 1,200 per minute); responses carry the standard
   `X-RateLimit-*` headers. `Idempotency-Key` is forwarded to the delegated
   mutation and namespaced by the caller so two tenants can never share a
   cached result.

5. **The OpenAPI 3.1 document is generated, not hand-written.** Zod schemas in
   `@workspace/contracts` are converted with `z.toJSONSchema`, assembled into a
   manifest-checked document and committed to the landing at
   `/downloads/openapi.json`; `npm run verify:openapi` fails on drift and the
   unit suite fails when a route file and the manifest disagree.

6. **Webhooks are signed, retried and replayable.** `WebhookSubscription` and
   `WebhookDelivery` live in the identity database. Domain apps emit events
   through the versioned `WebhookClient` with the `internal:webhooks:write`
   scope; Copilot fans out one delivery per matching active endpoint atomically.
   Each delivery is one `POST` of the exact envelope with
   `X-Asynchrone-Signature: sha256=<HMAC-SHA256 hex>`, delivery, event and
   timestamp headers, a 10-second timeout and no redirects. Endpoints must be
   HTTPS and must not resolve to a private address (re-checked per attempt).
   Retries use six backoffs (1 m, 5 m, 30 m, 2 h, 8 h, 24 h) for seven attempts;
   `410` or an inactive endpoint stops immediately. Secrets are AES-256-GCM
   encrypted at rest and shown once. The Developers tab lists the delivery log
   and replays failed deliveries; rows are pruned after 30 days by the
   every-minute `webhook-deliveries` CronJob, which claims work with
   `FOR UPDATE SKIP LOCKED`.

## Consequences

- Customers get one stable, documented surface, a downloadable spec and a
  signed event stream without any new host or dependency.
- Copilot becomes the public API gateway and must stay available for domain
  data to be reachable through it; a down domain app surfaces as a mapped
  downstream error, not a partial result.
- A token's effective permissions can shrink without warning when the member's
  role changes; that is intentional and documented.
- File endpoints expose metadata only in v1; binary download URLs for API
  tokens are not part of this decision.
- Webhook emission is best-effort at the mutation site: a failed internal emit
  is logged and never rolls back the customer's write.
