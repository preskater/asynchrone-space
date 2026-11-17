# Public REST API and outbound webhooks

The versioned REST API lets a workspace's scripts and integrations read and
write its own data. It is hosted on the apex at `https://asynchrone.space/api/v1`
(one Ingress path routes `/api/v1` to Copilot; there is no separate API host).
The decision is recorded in [ADR 0039](adr/0039-expose-a-versioned-public-rest-api.md).

## Authentication

Create a token in **Settings → Developers → API tokens** (owners and admins).
The raw value is shown exactly once; only its SHA-256 hash is stored.

```http
Authorization: Bearer async_<32 random bytes, base64url>
X-Asynchrone-Organization: <organization id or slug>   # optional
```

- A token belongs to the organization it was created in and acts on behalf of
  the member who created it. Every request re-reads that membership: a removed
  member's token stops working immediately, and the token can never exceed the
  member's current role.
- The organization header is optional. When present it must match the token's
  organization id or slug; anything else returns `403 organization_mismatch`.
  There is no way to address another organization.
- Client-portal accounts cannot use the API.
- Tokens can expire (`1–730` days, or never). Revocation is immediate and
  idempotent. A workspace keeps at most 50 active tokens.

### Scopes

| Scope            | Grants                                             |
| ---------------- | -------------------------------------------------- |
| `projects:read`  | List and read projects                             |
| `projects:write` | Create, update and delete projects                 |
| `tasks:read`     | List and read tasks                                |
| `tasks:write`    | Create, update and delete tasks                    |
| `clients:read`   | Read clients, contacts and deals                   |
| `clients:write`  | Create and update clients, contacts and deals; move deals |
| `employees:read` | Read employee profiles                             |
| `files:read`     | Read file metadata                                 |

A write scope never bypasses the member's role: the owning domain app still
applies its own permission checks.

### Plans and rate limits

All plans currently include API access. Limits are per token, fixed window of
one minute:

| Plan       | Requests per minute |
| ---------- | ------------------- |
| Free       | 60                  |
| Team       | 300                 |
| Enterprise | 1,200               |

Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset` (Unix seconds). A `429` also carries `Retry-After`.

## Endpoints

| Method   | Path                           | Scope            |
| -------- | ------------------------------ | ---------------- |
| `GET`    | `/api/v1/me`                   | any valid token  |
| `GET`    | `/api/v1/projects`             | `projects:read`  |
| `POST`   | `/api/v1/projects`             | `projects:write` |
| `GET`    | `/api/v1/projects/{id}`        | `projects:read`  |
| `PATCH`  | `/api/v1/projects/{id}`        | `projects:write` |
| `DELETE` | `/api/v1/projects/{id}`        | `projects:write` |
| `GET`    | `/api/v1/tasks`                | `tasks:read`     |
| `POST`   | `/api/v1/tasks`                | `tasks:write`    |
| `GET`    | `/api/v1/tasks/{id}`           | `tasks:read`     |
| `PATCH`  | `/api/v1/tasks/{id}`           | `tasks:write`    |
| `DELETE` | `/api/v1/tasks/{id}`           | `tasks:write`    |
| `GET`    | `/api/v1/clients`              | `clients:read`   |
| `POST`   | `/api/v1/clients`              | `clients:write`  |
| `GET`    | `/api/v1/clients/{id}`         | `clients:read`   |
| `PATCH`  | `/api/v1/clients/{id}`         | `clients:write`  |
| `GET`    | `/api/v1/contacts`             | `clients:read`   |
| `POST`   | `/api/v1/contacts`             | `clients:write`  |
| `GET`    | `/api/v1/contacts/{id}`        | `clients:read`   |
| `PATCH`  | `/api/v1/contacts/{id}`        | `clients:write`  |
| `GET`    | `/api/v1/deals`                | `clients:read`   |
| `POST`   | `/api/v1/deals`                | `clients:write`  |
| `GET`    | `/api/v1/deals/{id}`           | `clients:read`   |
| `PATCH`  | `/api/v1/deals/{id}`           | `clients:write`  |
| `POST`   | `/api/v1/deals/{id}/move`      | `clients:write`  |
| `GET`    | `/api/v1/employees`            | `employees:read` |
| `GET`    | `/api/v1/employees/{userId}`   | `employees:read` |
| `GET`    | `/api/v1/files`                | `files:read`     |
| `GET`    | `/api/v1/files/{id}`           | `files:read`     |

The machine-readable contract is the OpenAPI 3.1 document generated from the
Zod schemas: [landing `/downloads/openapi.json`](../apps/landing/public/downloads/openapi.json),
also linked from the public docs page at `/en/docs/api`. Regenerate and verify
it with `npm run openapi:generate --workspace=copilot` and
`npm run verify:openapi`; the unit suite fails when a route file and the
manifest disagree.

To exercise the running API without creating a token in Settings, run
`npm run verify:public-api`. It seeds a throwaway
organization, user and token, drives the auth/organization/scope/rate-limit
failures and a full project round-trip (including an idempotent retry), and
cleans up. Set `PUBLIC_API_URL` to target a deployment.

```bash
# from the repository root; Copilot must be running and DATABASE_URL migrated
npm run verify:public-api
```

### Pagination

Lists accept `limit` (1–100, default 50) and an opaque `cursor`. Responses are
`{ "data": [...], "meta": { "nextCursor": "…" | null, "requestId": "…" } }`;
pass `nextCursor` back as `cursor`. Cursors are keyset-based (newest first), so
pages stay stable while rows are added.

### Errors

```json
{
  "error": { "code": "insufficient_scope", "message": "This token lacks the tasks:read scope." },
  "meta": { "requestId": "…" }
}
```

| Code                    | Status |
| ----------------------- | ------ |
| `missing_token`         | 401    |
| `invalid_token`         | 401    |
| `expired_token`         | 401    |
| `revoked_token`         | 401    |
| `insufficient_scope`    | 403    |
| `organization_mismatch` | 403    |
| `upgrade_required`      | 403    |
| `forbidden`             | 403    |
| `not_found`             | 404    |
| `conflict`              | 409    |
| `validation_error`      | 422    |
| `rate_limited`          | 429    |
| `internal_error`        | 500    |

Validation failures add `error.details` with `{ path, message }` entries.
Internal errors never expose database or upstream messages. `meta.requestId`
matches the `x-request-id` response header and the structured logs.

`POST` and `PATCH` accept an `Idempotency-Key` header; retrying a mutation with
the same key and body returns the original outcome instead of writing twice.
Every mutation writes an `AuditLog` row in the owning app with the token as the
actor (`api-token:<token id>`), so Settings → Audit log shows which token made
the change.

## Webhooks

Subscriptions live in the same Developers tab (owners and admins), at most 20
active endpoints per workspace. Each endpoint selects events from the catalogue:

`project.created|updated|deleted`, `task.created|updated|deleted`,
`client.created|updated`, `contact.created|updated`, `deal.created|updated`,
`deal.stage_changed`, `member.added|removed`.

The signing secret is shown once at creation and encrypted at rest
(AES-256-GCM, purpose `webhook-secret`). Editing an endpoint never returns it.

### Delivery and signature

Each event is one `POST` with the envelope as the exact JSON body:

```http
Content-Type: application/json
User-Agent: Asynchrone-Webhooks/1.0
X-Asynchrone-Signature: sha256=<hex HMAC-SHA256 of the raw body>
X-Asynchrone-Delivery: <delivery id>
X-Asynchrone-Event: <event type>
X-Asynchrone-Timestamp: <unix seconds>
```

Verify the signature over the **raw body** before parsing it:

```ts
import { createHmac, timingSafeEqual } from "node:crypto"

const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`
const received = request.headers["x-asynchrone-signature"] ?? ""
const ok =
  received.length === expected.length &&
  timingSafeEqual(Buffer.from(received), Buffer.from(expected))
```

The envelope is
`{ id, type, occurredAt, organizationId, data }`; `data` is the same public
resource shape the REST API returns. Deliveries use a 10-second timeout, do not
follow redirects, and require an HTTPS URL that does not resolve to a private,
loopback or link-local address (re-checked at every attempt).

### Retries, log and replay

A failed attempt is retried after 1 m, 5 m, 30 m, 2 h, 8 h and 24 h (7 attempts
in total). A `410`, an inactive or deleted subscription stops immediately. The
settings page shows the delivery log (status, attempts, HTTP code, last error,
next retry) and can replay any failed delivery; replays are audited.
Deliveries are pruned after 30 days. A Copilot CronJob
(`webhook-deliveries`, every minute) claims due rows with `FOR UPDATE SKIP
LOCKED`, so replicas never send the same delivery twice.

## How it is wired

Copilot owns `/api/v1/*`, the token store and the webhook tables (`ApiToken`,
`WebhookSubscription`, `WebhookDelivery` in the identity database). Each route
authenticates the token, then delegates the data operation through
`DomainClient` (`POST /internal/v1/domain/:operation`) to the owning app —
projects, clients, employees, files — which applies its own permissions and
writes its own audit row. Copilot never opens another app's database. Domain
apps emit webhook events through the versioned `WebhookClient` to
`/internal/v1/webhooks/events`; only projects and clients hold the
`internal:webhooks:write` scope.

Not in v1: GraphQL, generated SDKs, bidirectional sync connectors, and using
webhooks as a real-time replacement for the workspace UI.
