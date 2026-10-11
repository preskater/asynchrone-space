# Architecture Decision Records

This directory holds the Architecture Decision Records (ADRs) for Presk. Each
record captures one architecturally significant decision together with its
context, the options that were considered, and the consequences.

Records are written with the
[MADR](https://adr.github.io/madr/) template (Markdown Any Decision Records)
from the [architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record)
collection.

## Conventions

- One decision per file, named `NNNN-short-title.md` (zero-padded, sequential).
- Status is one of `proposed`, `accepted`, `deprecated`, or `superseded by [ADR-XXXX](XXXX-....md)`.
- Records are immutable: to change a decision, add a new record that supersedes
  the old one rather than editing it. Additive updates are allowed with a dated
  note.

## Index

| ADR                                                       | Status   | Decision                                                                 |
| --------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| [0001](0001-use-monorepo-with-turborepo.md)               | accepted | Use a monorepo with Turborepo and npm workspaces                         |
| [0002](0002-use-nextjs-app-router.md)                     | accepted | Use Next.js App Router with React 19                                     |
| [0003](0003-use-postgresql-with-prisma-driver-adapter.md) | accepted | Use PostgreSQL with Prisma 7 and the `@prisma/adapter-pg` driver adapter |
| [0004](0004-use-better-auth-with-organization-plugin.md)  | accepted | Use Better Auth with the organization plugin for multi-tenant RBAC       |
| [0005](0005-store-files-as-postgresql-large-objects.md)   | accepted | Store files as PostgreSQL large objects                                  |
| [0006](0006-expose-ai-assistant-over-mcp.md)              | accepted | Expose the AI assistant over MCP                                         |
| [0007](0007-use-shadcn-ui-with-base-ui.md)                | accepted | Use shadcn/ui with Base UI and Tailwind CSS                              |
| [0008](0008-use-next-intl-for-i18n.md)                    | accepted | Use next-intl for internationalization                                   |
| [0009](0009-ship-standalone-docker-image.md)              | accepted | Ship a standalone Docker image with a separate migration service         |
| [0010](0010-chunked-upload-protocol.md)                   | accepted | Use a chunked upload protocol with `UploadSession`                       |
| [0011](0011-authenticate-mcp-with-oauth2.md)              | accepted | Authenticate the MCP endpoint with OAuth2                                |
