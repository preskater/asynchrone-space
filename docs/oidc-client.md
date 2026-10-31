# OIDC client package

`@workspace/oidc` is the shared relying-party implementation for every workspace
app. It implements the browser-side and server-side halves of the code flow
against Copilot ([ADR 0029](../adr/0029-use-copilot-as-oauth-authorization-server.md)).

Do not hand-roll an OAuth client in an app. The package keeps the security
details (PKCE, state, cookie flags, token refresh, JWKS, back-channel logout)
in one place.

## Flow

```ts
import {
  MemorySessionStore,
  completeAuthorization,
  createAuthorizationRequest,
  readOAuthCookies,
  serializeOAuthCookies,
} from "@workspace/oidc"

const config = {
  issuer: "https://copilot.asynchrone.space",
  clientId: process.env.PROJECTS_OAUTH_CLIENT_ID!,
  clientSecret: process.env.PROJECTS_OAUTH_CLIENT_SECRET!,
  redirectUri: "https://projects.copilot.asynchrone.space/api/auth/callback",
  resource: "https://projects.copilot.asynchrone.space",
}
```

### Start

1. `createAuthorizationRequest(config, { prompt: "none" })` returns the URL,
   state, PKCE verifier and nonce.
2. Write the state/verifier/nonce with `serializeOAuthCookies(config, values)`
   as short-lived HttpOnly cookies.
3. Redirect to `request.url`.

### Callback

1. Read the cookies with `readOAuthCookies(config, cookieHeader)`.
2. `completeAuthorization(config, store, { code, state, expectedState, codeVerifier })`.
3. Append `completed.setCookies` to the response. The package sets the local
   session cookie and clears the OAuth cookies.
4. The session row is stored by the app's `OidcSessionStore`.

`completeAuthorization` validates state, exchanges the code with client
authentication, verifies the access token against Copilot's JWKS, requires the
`sid` and organization claims, and creates the local session.

## Sessions

`OidcSessionRecord` stores the Copilot `sid`, user, organization, encrypted
access/refresh tokens and expiry. `OidcSessionStore` is the storage contract;
`MemorySessionStore` is for tests. #183 provides the per-app Prisma adapter.

`resolveSession` returns a valid session or refreshes an expiring one. A failed
refresh deletes the local session; the caller redirects to Copilot.

- Secure mode uses `__Host-asynchrone_session` (Secure, Path=/, HttpOnly,
  SameSite=Lax, no Domain).
- Local HTTP uses `asynchrone_session` without the `__Host-` prefix.
- There is no shared `.copilot` cookie.

## Logout

- `handleBackChannelLogout(config, store, logoutToken)` verifies Copilot's
  logout token and deletes every local session with the same `sid`.
- `buildEndSessionUrl(config, { idToken, postLogoutRedirectUri, state })`
  starts RP-initiated logout.

## Verification

```bash
npm run test:unit --workspace=@workspace/oidc
npm run typecheck --workspace=@workspace/oidc
npm run lint --workspace=@workspace/oidc
```

The package is covered by 24 tests: PKCE, authorization URL, cookie flags,
token exchange/refresh, session refresh/failure, callback state and claims, and
back-channel logout.

## Follow-up

- #182 registers the client, redirect URIs, secrets and back-channel logout URI.
- #183 adds the Prisma session store per app.
- #169 adds the full logout and token-revocation hardening at the fleet level.
