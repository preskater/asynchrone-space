# Internal service authentication

Workspace apps call each other through `/internal/v1/*` endpoints. Every call
carries a short-lived OAuth **client-credentials** token issued by Copilot. The
audience is the target app, and the scope set is explicit
([ADR 0029](../adr/0029-use-copilot-as-oauth-authorization-server.md),
[ADR 0032](../adr/0032-give-each-app-its-own-database.md)).

`@workspace/service-auth` is the shared implementation. Do not call an internal
endpoint with a shared secret or an unauthenticated `fetch`.

## Caller

```ts
import { ServiceTokenClient, SERVICE_SCOPES } from "@workspace/service-auth"

const client = new ServiceTokenClient({
  issuer: "https://copilot.asynchrone.space",
  clientId: process.env.PROJECTS_OAUTH_CLIENT_ID!,
  clientSecret: process.env.PROJECTS_OAUTH_CLIENT_SECRET!,
})

const token = await client.getToken({
  audience: "urn:asynchrone:app:files",
  scopes: [SERVICE_SCOPES.domainRead],
})

await fetch("https://files.copilot.asynchrone.space/internal/v1/files/123", {
  headers: { Authorization: `Bearer ${token}` },
})
```

- The client posts `grant_type=client_credentials`, `resource=<audience>` and
  `scope=<scopes>` to `/api/auth/oauth2/token` with `client_secret_basic`.
- Tokens are cached per audience/scope set and refreshed 30 seconds before
  expiry.
- Call `client.clear(request)` after a `401` if the target revoked the token.

## Handler

```ts
import {
  SERVICE_SCOPES,
  ServiceTokenVerifier,
  requireInternalService,
} from "@workspace/service-auth"

const verifier = new ServiceTokenVerifier({
  issuer: process.env.COPILOT_APP_URL!,
  audience: "urn:asynchrone:app:projects",
})

export async function GET(request: Request) {
  const claims = await requireInternalService(request, verifier, {
    requiredScopes: [SERVICE_SCOPES.domainRead],
  })
  // claims.sub is the calling app; claims.client_id is its OAuth client.
}
```

The verifier checks the signature against Copilot's JWKS, the issuer, the
audience, expiry and required scopes. A token minted for another app is
rejected.

## Scope matrix

| Caller        | Target      | Scopes                                                                                                                                          |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Copilot       | domain apps | `internal:domain:read`, `internal:domain:write`, `internal:audit:read`, `internal:search:read`, `internal:export:read`, `internal:delete:write` |
| Domain apps   | Copilot     | `internal:identity:read`, `internal:notifications:write`                                                                                        |
| Control tower | Copilot     | `internal:identity:read`, `internal:identity:admin`                                                                                             |

`SERVICE_SCOPES` in `@workspace/contracts` is the source of truth.

## Network boundary

`/internal/*` is never exposed through public ingress. The deployment adds a
`NetworkPolicy` (Kubernetes) or relies on the compose network, and the ingress
must return 404 for the path. That enforcement lands with #192; this package
only verifies the token.

## Errors

`ServiceAuthError` carries `code` and `status`:

| Code                   | Status   | Meaning                                      |
| ---------------------- | -------- | -------------------------------------------- |
| `missing_token`        | 401      | No Bearer header                             |
| `invalid_token`        | 401      | Signature, issuer, audience or expiry failed |
| `invalid_claims`       | 401      | Required claims are missing                  |
| `insufficient_scope`   | 403      | Token lacks a required scope                 |
| `missing_scope`        | 400      | Caller requested no scopes                   |
| `token_request_failed` | upstream | Token endpoint rejected the client           |

Map these directly; do not leak the token or client secret in the response.

## Verification

```bash
npm run test:unit --workspace=@workspace/service-auth
npm run typecheck --workspace=@workspace/service-auth
npm run lint --workspace=@workspace/service-auth
```

Covers token requests, caching, expiry skew, audience binding, scope checks,
expired tokens and missing Bearer headers.

## Follow-up

- #182 provisions the client IDs/secrets and `client_credentials_scopes`.
- #186 adds the identity internal API handlers.
- #192 adds ingress/network enforcement.
