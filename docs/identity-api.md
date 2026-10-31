# Identity internal API

Copilot exposes the identity read model at `/internal/v1/*` for workspace apps.
It replaces direct reads of the identity database from every domain app.

## Endpoints

| Method | Path                                          | Response       |
| ------ | --------------------------------------------- | -------------- |
| `GET`  | `/internal/v1/organizations/:id`              | `Organization` |
| `GET`  | `/internal/v1/organizations/:id/members`      | `Member[]`     |
| `GET`  | `/internal/v1/organizations/:id/entitlements` | `Entitlements` |
| `GET`  | `/internal/v1/users/:id`                      | `User`         |

The schemas and route constants live in `@workspace/contracts`. Every success
response is `{ data, meta: { app: "copilot", version: "v1", requestId } }` with
`Cache-Control: private, max-age=30`. Errors are
`{ error: { code, message } }`.

`Member` includes `clientId` so callers can exclude portal accounts from
workspace pickers. `Entitlements` includes `seats: null` for unlimited plans.

## Authentication

The handler uses `@workspace/service-auth`:

- audience `urn:asynchrone:app:copilot`;
- required scope `internal:identity:read`;
- issuer `COPILOT_APP_URL` or `BETTER_AUTH_URL`;
- JWKS from Copilot.

The route is excluded from the next-intl middleware and is never public.
Ingress must return 404 for `/internal/*`; that enforcement lands in #192.

`internal:identity:admin` is reserved for #191 (control-tower admin API).

## Client

`@workspace/contracts` exports `IdentityClient`:

```ts
import { IdentityClient, SERVICE_SCOPES } from "@workspace/contracts"
import { ServiceTokenClient } from "@workspace/service-auth"

const tokens = new ServiceTokenClient({
  issuer: process.env.COPILOT_APP_URL!,
  clientId: process.env.PROJECTS_OAUTH_CLIENT_ID!,
  clientSecret: process.env.PROJECTS_OAUTH_CLIENT_SECRET!,
})

const identity = new IdentityClient({
  baseUrl: process.env.COPILOT_APP_URL!,
  getToken: ({ audience, scopes }) => tokens.getToken({ audience, scopes }),
})

const members = await identity.listMembers(organizationId)
identity.invalidate(organizationId)
```

The client caches each path for 30 seconds. Call `invalidate(organizationId)`
after a member/role mutation. The token getter is injected so the contracts
package does not depend on `service-auth`.

## Data source

The handler reads `@workspace/db-identity` (`IDENTITY_DATABASE_URL`). It does not
use the monolith database. Local tests use a fake `IdentityRepository`; after
#185 the identity database is the source of truth.

## Tests

```bash
npm run test:unit --workspace=web
npm run test:unit --workspace=@workspace/contracts
```

Covers route selection, 404s, service-token failures, cache headers and the
typed client’s caching/error mapping.

## Follow-up

- #187 audit endpoints.
- #188 export/deletion endpoints.
- #191 admin endpoints.
- #192 ingress/network enforcement.
