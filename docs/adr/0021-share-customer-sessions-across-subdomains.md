# Share customer sessions across app subdomains

- Status: proposed
- Deciders: Presk maintainers
- Date: 2026-10-23

## Context and Problem Statement

ADR 0020 splits the customer workspace into apps on subdomains. A user must sign
in once and be authenticated in every app, and organization switching and
impersonation must apply everywhere. The control tower deliberately keeps a
host-only cookie (ADR 0018).

## Decision Drivers

- **One sign-in.** Moving between apps must not require re-authentication.
- **Small blast radius.** A compromise of one app's session model must not grant
  platform access.
- **No cross-origin auth traffic.** Keep CSP `connect-src 'self'` and avoid CORS.
- **Runtime configuration.** One image must work in every environment.

## Considered Options

1. Shared parent-domain cookie for all customer apps (`Domain=.presk.re`).
2. Central auth app plus a signed handoff into host-only sessions.
3. Per-app Better Auth instances with host-only cookies.

## Decision Outcome

Chosen option: **shared parent-domain cookie for the customer apps**, with the
control tower staying isolated.

- `apps/web` remains the only auth server and mounts `/api/auth/[...all]`, OAuth,
  `/mcp` and the platform handoff.
- All customer apps configure the same `BETTER_AUTH_SECRET`, the same cookie
  prefix, and `advanced.crossSubDomainCookies` when `AUTH_COOKIE_DOMAIN` is set.
  In production `AUTH_COOKIE_DOMAIN=.presk.re`; in development it is unset
  because cookies already span ports on `localhost`.
- `trustedOrigins` is built from the app-URL registry and must list every host.
- Feature apps instantiate the shared auth config but never mount auth routes.
  They read the session from the shared cookie and resolve the organization role
  from the `member` table.
- Organization switching and sign-out navigate to shell routes. Feature apps do
  not call the auth server from the browser, so CSP and CORS stay simple.
- Host URLs reach the client as server-rendered props; no `NEXT_PUBLIC_*` host is
  baked into an image.
- Impersonation keeps its single-use, audited handoff. The handoff creates a
  customer session and, with the shared cookie, every app sees it. Every app
  applies the one-hour TTL and renders the shared banner.
- The portal uses the same customer cookie. Internal apps reject `clientId`
  members; authorization, not cookie isolation, protects the workspace. Only
  first-party apps may ever be hosted under `*.presk.re`.
- The control tower keeps its own secret, cookie prefix and host-only cookie.
  `verify:auth-config` continues to assert this.

### Positive Consequences

- One sign-in across the workspace; no re-authentication or handoff per app.
- No cross-origin browser auth calls; CSP stays `connect-src 'self'`.
- The platform auth boundary is unchanged.

### Negative Consequences

- Any app on `*.presk.re` can read or overwrite the customer session cookie. The
  domain must never host third-party or user-controlled content.
- The portal's cookie is transmitted to internal hosts. This is accepted because
  internal apps authorize `clientId` members out; the alternative is a separate
  portal auth surface.
- Rotating `BETTER_AUTH_SECRET` invalidates sessions and the encrypted JWKS rows
  in every app at once.

### Links

- ADR 0020: split the workspace into domain apps
- ADR 0018: control tower on a shared database package
- Better Auth `advanced.crossSubDomainCookies`
