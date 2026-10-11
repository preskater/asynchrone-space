# Store files as PostgreSQL large objects

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk lets users upload, store, download, and attach files. File bytes must be
stored somewhere durable with metadata kept queryable and consistent. The
project previously used Vercel Blob (an external object store) and migrated away
from it. Where should file bytes live, and how should they be streamed given
serverless request-body limits?

## Decision Drivers

- Metadata and bytes must stay consistent; a single transactional store avoids
  orphaned or dangling objects.
- Avoid a second infrastructure dependency and its credentials/pricing model.
- Serverless functions cap request bodies (Vercel: 4.5 MB), so large files
  cannot be sent in one request.
- Downloads should stream without buffering the whole file in memory.

## Considered Options

- PostgreSQL large objects (`pg_largeobject`) in the same database as metadata.
- External object storage (S3-compatible) with metadata in Postgres.
- Vercel Blob (the previous approach).

## Decision Outcome

Chosen option: "PostgreSQL large objects in the same database as metadata",
because it keeps bytes and metadata in one transactional store and removes an
external dependency.

`lib/large-object.ts` streams bytes into and out of large objects using a
dedicated connection inside a `BEGIN … COMMIT` transaction; responses use
`Readable.toWeb(...)` so nothing is buffered in memory. `FileNode`,
`FileVersion`, and `MessageAttachment` hold `oid BigInt? @unique`, `sizeBytes`,
`mimeType`, and `sha256`. The migration
`20261009140000_replace_blob_with_large_object` dropped `storageKey`; old Blob
bytes were not imported.

### Positive Consequences

- One transactional store for metadata and bytes; deletes can unlink the
  backing large object alongside the metadata.
- No external object-store credentials, SDKs, or vendor egress costs.
- Streaming reads and writes avoid buffering large files in memory.
- The single shared `pg.Pool` from [ADR-0003](0003-use-postgresql-with-prisma-driver-adapter.md)
  is reused for all large-object operations.

### Negative Consequences

- Each in-flight upload/download occupies one pooled connection for the whole
  transfer (default pool max `3`), so concurrent transfers compete with Prisma
  traffic. Raise `DATABASE_POOL_MAX` or use a separate pool if needed.
- There is no fixed per-file cap; uploads are bounded only by the organization's
  storage quota, and very large downloads are best served from a dedicated
  media host.
- The database grows with blob data, which can complicate backup size and
  restore times.
- No migration path was provided for previously stored Blob bytes.

## Pros and Cons of the Options

### PostgreSQL large objects

- Good, because metadata and bytes share one transaction and one store.
- Good, because no external service or credentials are required.
- Bad, because transfers hold pool connections and bloat the database.

### External object storage (S3-compatible)

- Good, because it scales to large files and offloads bytes from the database.
- Good, because it supports CDN delivery and resumable, presigned uploads.
- Bad, because it adds infrastructure, credentials, and a consistency gap
  between metadata and bytes.

### Vercel Blob

- Good, because it was managed and simple to integrate on Vercel.
- Bad, because it is a vendor-hosted external store with the same consistency
  and dependency downsides as any object store.

## Links

- `apps/web/lib/large-object.ts`
- `apps/web/lib/prisma.ts`
- `apps/web/prisma/migrations/20261009140000_replace_blob_with_large_object`
- `README.md` — "File storage" and "Operational caveats"
- [ADR-0010](0010-chunked-upload-protocol.md) — the upload protocol built on this
