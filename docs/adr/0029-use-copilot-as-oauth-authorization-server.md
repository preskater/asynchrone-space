# Use Copilot as the OAuth 2.1 authorization server

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-31

## Context and Problem Statement

ADR 0028 splits the workspace into a stateless landing site, a Copilot shell and
domain apps under `*.copilot.asynchrone.space`. ADR 0032 gives every app its own
database. A shared parent-domain cookie no longer fits: it would give every app
the same session, blur the authorization boundary and couple session storage to
the identity database.

How do independently deployed apps authenticate a user once, receive only the
access they need, and terminate that access when the Copilot session ends?

## Decision Drivers

- **No shared session.** A compromised app must not be able to read or overwrite
  another app's session.
- **Least privilege.** An app receives a token bound to its own audience and
  scopes, not a token usable against every app.
- **Identity in one place.** Users, organizations, members, roles and 2FA stay in
  Copilot.
- **Standards.** Use OAuth 2.1 and OIDC instead of a custom handoff.
- **Logout and revocation.** Ending the Copilot session must end the app
  sessions.
- **Incremental migration.** The monolith keeps working while apps move to OIDC.

## Considered Options

1. Keep the shared `.copilot.asynchrone.space` cookie.
2. Make Copilot the OAuth 2.1/OIDC authorization server and give every app a
   host-only session.
3. Give every app its own Better Auth instance and cookie.

## Decision Outcome

Chosen option: **Copilot is the OAuth 2.1/OIDC authorization server**, with a
host-only session per app.

### Authorization server

- `apps/copilot` runs Better Auth with the `mcp()` plugin. The MCP plugin _is_ the
  OAuth provider for this instance; do not also register `oauthProvider()`.
- Extend `mcp()` with generic OAuth options: first-party clients, per-app
  resources, scopes, custom claims, token lifetimes, refresh rotation and
  back-channel logout.
- MCP remains a protected resource at
  `https://copilot.asynchrone.space/mcp`.
- The provider serves OAuth authorization-server metadata, OIDC discovery,
  UserInfo, the token endpoint, introspection, revocation and end-session.

### Clients and tokens

- Every workspace app is a first-party **confidential** OIDC client with an exact
  redirect URI, `skip_consent`, `enable_end_session` and a
  `backchannel_logout_uri`.
- Authorization uses the authorization-code flow with S256 PKCE. The code is
  exchanged server-side; the client secret never reaches the browser.
- Access tokens are short-lived JWTs bound to the app's `resource` audience.
  Refresh tokens rotate and are requested with `offline_access`.
- Claims include `sub`, `org`, `org_slug`, `role`, `plan`, `sid`,
  `amr`/`acr`, and `act` for impersonation. Entitlements that must be exact are
  read from the identity internal API rather than trusted forever from a token.
- Organization switching ends or revokes the user's app grants and triggers a
  re-authorization for the new organization.
- Customer 2FA and the organization `requireTwoFactor` policy are enforced during
  authorization in Copilot. Tokens carry the resulting `amr`/`acr`; apps do not
  re-challenge an authenticated session.
- Impersonation is carried in `act`; every app enforces the one-hour TTL and
  signs the session out when it expires or when impersonation stops.

### App sessions

- Each app keeps a host-only `__Host-` session cookie and a session row in its
  own database.
- The row stores the Copilot `sid`, user and organization IDs, encrypted access
  and refresh tokens, and the expiry.
- On request, the app verifies the access token against Copilot's JWKS. When it
  expires, the app refreshes it; a failed refresh ends the local session and
  redirects to Copilot.
- Back-channel logout verifies Copilot's logout token and deletes local sessions
  by `sid`. RP-initiated logout deletes the local session and ends the Copilot
  session.
- The landing site has no session. The control tower keeps its own host-only
  platform session and never uses the customer authorization server.

### Service-to-service access

- Internal calls use OAuth `client_credentials` tokens with an audience bound to
  the target app and an explicit scope set.
- Each app caches its service tokens until shortly before expiry.
- `/internal/*` routes verify the issuer, audience and scopes and are blocked at
  ingress. Network policies are defence in depth.

## Consequences

### Positive

- No shared browser session across apps; each app has its own `__Host-` cookie.
- Tokens are audience-bound and scoped, so a leaked token has a smaller blast
  radius.
- 2FA, organization policy and impersonation are enforced once, in Copilot.
- Logout and revocation have standard OIDC mechanisms.

### Negative

- Each app must implement the OIDC client flow, token refresh and logout
  handling.
- Users may see a short authorization redirect on first entry to an app; with an
  existing Copilot session it is normally invisible.
- JWT access tokens cannot be revoked individually; short lifetimes and
  back-channel logout are the control.
- Org switching requires re-authorization or token revocation across apps.
- Client secrets/keys, redirect URIs and logout endpoints must be provisioned and
  rotated for every app.
- More moving parts than a shared cookie: JWKS caching, clock skew, refresh
  failures, partial logout.

## Links

- [0028](0028-split-workspace-into-domain-apps.md) — the landing, Copilot shell
  and domain-app split
- [0032](0032-give-each-app-its-own-database.md) — database per app
- [0033](0033-keep-audit-export-and-deletion-consistent-across-databases.md) —
  cross-database consistency
- [0011](0011-authenticate-mcp-with-oauth2.md) — the existing MCP OAuth setup
- [0018](0018-control-tower-on-shared-database-package.md) — control-tower
  isolation
- Issue [#145](https://github.com/preskater/asynchrone-space/issues/145)
- Better Auth OAuth Provider and `@better-auth/mcp`
