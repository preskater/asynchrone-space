# Authenticate the MCP endpoint with OAuth2

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

[ADR-0006](0006-expose-ai-assistant-over-mcp.md) exposed `/mcp` with dual
authentication: a browser session cookie or a static, shared
`MCP_SERVICE_TOKEN` bearer value. A shared secret cannot be scoped per client,
rotated without coordination, or bound to a single user and organization, and
MCP clients expect a standard authorization flow. How should MCP clients be
authenticated and authorized?

## Decision Drivers

- MCP clients (Cursor, Claude, the MCP Inspector) expect OAuth 2.1 discovery.
- Access must be bound to a user, organization, and role.
- No shared, long-lived secret to rotate or leak.
- Tokens should be verifiable locally and short-lived.

## Considered Options

- OAuth 2.1 authorization server via `@better-auth/mcp` (client ID metadata
  documents, RFC 8414/9728 discovery, JWT access tokens).
- OAuth 2.1 provider (`@better-auth/oauth-provider`) with dynamic client
  registration and the existing `mcp-handler` transport.
- Keep the static `MCP_SERVICE_TOKEN`.

## Decision Outcome

Chosen option: "OAuth 2.1 authorization server via `@better-auth/mcp`", because
it is the library's supported MCP integration and replaces the shared secret
with per-client, audience-bound tokens.

`lib/auth.ts` registers the `jwt`, `mcp`, and `cimd` plugins. `mcp()` is the
OAuth provider configured for the MCP resource (default `${BETTER_AUTH_URL}/mcp`,
overridable with `MCP_RESOURCE_URL`); `cimd()` supplies client identity through
Client ID Metadata Documents (MCP 2026-07-28 profile). `customAccessTokenClaims`
attaches the organization and role captured at consent
(`postLogin.consentReferenceId` reads the session's active organization), and
`postLogin` routes users without an active organization to
`/[locale]/select-organization`.

`app/mcp/route.ts` serves a stateless MCP 2026-07-28 endpoint built with the
official SDK v2 (`@modelcontextprotocol/server`), wrapped in `requireMcpAuth`,
which verifies the JWT against `/api/auth/jwks` and rejects legacy traffic.
`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`,
and `/.well-known/openid-configuration` are forwarded to the Better Auth handler.
The new `/consent` page (localized) renders the requesting client and scopes and
records the user's decision.

### Positive Consequences

- MCP clients authorize through standard OAuth 2.1 discovery and PKCE.
- Tokens are user-, organization-, and audience-bound, with a short lifetime.
- No shared machine secret to distribute, rotate, or leak.
- Authorization is reviewable per client via `oauthConsent`.

### Negative Consequences

- Adds OAuth tables (`oauthClient`, `oauthResource`, `oauthAccessToken`, …) and
  `jwks` to the database.
- Introduces consent and organization-selection screens to the MCP flow.
- MCP is pinned to the 2026-07-28 protocol; 2025-era clients are rejected.
- The `MCP_SERVICE_*` environment variables and static-token path are removed.

## Pros and Cons of the Options

### `@better-auth/mcp`

- Good: first-party integration; discovery, PKCE, CIMD, and JWKS verification.
- Good: claims carry user, organization, and role.
- Bad: larger schema and new UI surfaces.

### `@better-auth/oauth-provider` + `mcp-handler`

- Good: keeps the existing transport.
- Bad: diverges from the library's MCP profile and the stateless 2026-07-28 spec.

### Static `MCP_SERVICE_TOKEN`

- Good: trivial to implement.
- Bad: shared, unscoped, and not bound to an organization or user.

## Links

- `apps/web/lib/auth.ts`
- `apps/web/app/mcp/route.ts`
- `apps/web/lib/mcp/context.ts`
- `apps/web/app/[locale]/consent/page.tsx`
- `apps/web/prisma/schema.prisma` — OAuth and JWKS tables

## Update

2026-10-10: Dynamic Client Registration (RFC 7591) was enabled alongside
CIMD to support MCP clients that predate Client ID Metadata Documents (for
example, opencode registers through DCR). `mcp()` sets
`allowDynamicClientRegistration` and `allowUnauthenticatedClientRegistration`;
discovery advertises `registration_endpoint`. Because DCR defaults an omitted
`application_type` to `web` — which rejects the loopback `http://127.0.0.1`
callback native MCP clients use — a global `hooks.before` defaults an omitted
`application_type` to `native`. CIMD remains the preferred mechanism, and DCR
can be turned off once clients in use support CIMD. An `opencode.jsonc` at the
repo root wires the production endpoint into opencode.

