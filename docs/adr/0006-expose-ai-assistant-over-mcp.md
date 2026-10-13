# Expose the AI assistant over MCP

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk is AI-native: an assistant can read and modify the user's projects, tasks,
calendars, files, and messages. The same capabilities are also useful to external
agents and machine clients. How should assistant and third-party agent access to
workspace data be exposed in a consistent, authenticated way?

## Decision Drivers

- The assistant needs a typed, permission-scoped tool surface over domain data.
- External agents (and machine-to-machine clients) should use the same surface
  rather than bespoke endpoints.
- Access must be bound to a user/organization context with a role.
- Avoid sending trace data to third parties by default.

## Considered Options

- An MCP server (via `mcp-handler`) as the shared tool surface, consumed by the
  OpenAI Agents SDK and external MCP clients.
- Bespoke REST endpoints specific to the assistant.
- Embed the model provider directly in clients.

## Decision Outcome

Chosen option: "An MCP server as the shared tool surface", because one
authenticated, permission-scoped tool registry can serve both the in-app
assistant and external machine clients.

`app/mcp/route.ts` creates an MCP handler with `withMcpAuth` and a `verifyToken`
function that accepts either a session (resolving the active organization and
member role) or a service token from environment variables. Tools are registered
in `lib/mcp/server.ts`. The assistant uses the OpenAI Agents SDK (`@openai/agents`)
via `lib/assistant/agent.ts`, with `lib/assistant/provider.ts` disabling tracing
by default and selecting the Responses API for real OpenAI endpoints or Chat
Completions for custom OpenAI-compatible base URLs.

### Positive Consequences

- One tool registry serves the app assistant and external agents, avoiding
  duplicated access logic.
- Auth context (user, organization, role) is resolved once at the transport edge
  and passed into tools.
- A service token enables machine-to-machine use under `/mcp`.
- Tracing is disabled unless explicitly enabled, limiting data egress.

### Negative Consequences

- The MCP tool surface becomes a public contract that must be versioned and kept
  stable for external clients.
- Dual authentication (session and service token) increases the security
  surface that must be reviewed.
- Assistant availability depends on `OPENAI_API_KEY` and, for custom gateways,
  correct `OPENAI_API_URL` configuration.

## Pros and Cons of the Options

### MCP server as the shared surface

- Good, because the assistant and external agents share one tool set and auth.
- Good, because tools receive a resolved request context (role, org, user).
- Bad, because it is an externally consumed contract with compatibility
  obligations.

### Bespoke REST endpoints for the assistant

- Good, because it can be tailored exactly to the assistant's needs.
- Bad, because external agents need a separate interface and duplicated logic.

### Embed the model provider directly in clients

- Good, because it removes a server round trip.
- Bad, because API keys and provider credentials would leak to clients.

## Links

- `apps/web/app/mcp/route.ts`
- `apps/web/lib/mcp/server.ts`
- `apps/web/lib/assistant/agent.ts`
- `apps/web/lib/assistant/provider.ts`
- `README.md` — environment variables (`MCP_SERVICE_*`, `OPENAI_*`)

## Update

2026-10-10: The MCP endpoint's authentication was replaced. The session/static
service-token `verifyToken` described above is superseded by OAuth 2.1 via
`@better-auth/mcp`; see [ADR-0011](0011-authenticate-mcp-with-oauth2.md). The
`MCP_SERVICE_*` variables are removed.
