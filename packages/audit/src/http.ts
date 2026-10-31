import {
  INTERNAL_API_VERSION,
  AuditPruneRequestSchema,
} from "@workspace/contracts"

import type { AuditDb } from "./db"
import {
  AUDIT_EXPORT_LIMIT,
  auditPageInputSchema,
  auditFilterSchema,
  type AuditFilter,
} from "./filters"
import { AuditReader, type AuditReaderOptions } from "./reader"

export interface AuditHttpOptions {
  /** App key, used in the response envelope. */
  app: string
  db: AuditDb
  authorizeRead: (request: Request) => Promise<unknown>
  authorizeWrite: (request: Request) => Promise<unknown>
  reader?: AuditReaderOptions
}

interface HttpErrorLike {
  status: number
  code: string
  message: string
}

function isHttpError(value: unknown): value is HttpErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { status?: unknown }).status === "number" &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  )
}

function envelope(app: string, data: unknown, status = 200): Response {
  return Response.json(
    {
      data,
      meta: {
        app,
        version: INTERNAL_API_VERSION,
        requestId: crypto.randomUUID(),
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    }
  )
}

function error(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}

async function authorized(
  request: Request,
  authorize: (request: Request) => Promise<unknown>
): Promise<Response | null> {
  try {
    await authorize(request)
    return null
  } catch (cause) {
    if (isHttpError(cause)) {
      return error(cause.status, cause.code, cause.message)
    }
    console.error("[audit] internal authorization failed", cause)
    return error(401, "unauthorized", "A valid service token is required")
  }
}

function filterFrom(search: URLSearchParams): AuditFilter {
  const parsed = auditFilterSchema.parse({
    actorId: search.get("actorId") ?? undefined,
    action: search.get("action") ?? undefined,
    entityType: search.get("entityType") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
  })
  return parsed
}

function organizationFrom(search: URLSearchParams): string {
  const organizationId = search.get("organizationId")
  if (!organizationId) {
    throw Object.assign(new Error("organizationId is required"), {
      status: 400,
      code: "validation_error",
    })
  }
  return organizationId
}

function readerFor(options: AuditHttpOptions): AuditReader {
  return new AuditReader(options.db, options.reader)
}

/** `GET /internal/v1/audit` — one page of an organization's trail. */
export function createAuditListHandler(options: AuditHttpOptions) {
  return async function GET(request: Request): Promise<Response> {
    const denied = await authorized(request, options.authorizeRead)
    if (denied) return denied

    try {
      const search = new URL(request.url).searchParams
      const input = auditPageInputSchema.parse({
        ...filterFrom(search),
        cursor: search.get("cursor"),
        limit: search.get("limit") ? Number(search.get("limit")) : undefined,
      })
      const page = await readerFor(options).list(
        organizationFrom(search),
        input
      )
      return envelope(options.app, page)
    } catch (cause) {
      if (isHttpError(cause)) {
        return error(cause.status, cause.code, cause.message)
      }
      console.error("[audit] list failed", cause)
      return error(500, "internal_error", "Audit request failed")
    }
  }
}

/** `GET /internal/v1/audit/facets` — filter options for the trail. */
export function createAuditFacetsHandler(options: AuditHttpOptions) {
  return async function GET(request: Request): Promise<Response> {
    const denied = await authorized(request, options.authorizeRead)
    if (denied) return denied

    try {
      const search = new URL(request.url).searchParams
      const since = search.get("since")
      const sinceDate = since ? new Date(since) : undefined
      const facets = await readerFor(options).facets(
        organizationFrom(search),
        sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : undefined
      )
      return envelope(options.app, facets)
    } catch (cause) {
      if (isHttpError(cause)) {
        return error(cause.status, cause.code, cause.message)
      }
      console.error("[audit] facets failed", cause)
      return error(500, "internal_error", "Audit facets failed")
    }
  }
}

/** `GET /internal/v1/audit/export` — rows for a merged export. */
export function createAuditExportHandler(options: AuditHttpOptions) {
  return async function GET(request: Request): Promise<Response> {
    const denied = await authorized(request, options.authorizeRead)
    if (denied) return denied

    try {
      const search = new URL(request.url).searchParams
      const result = await readerFor(options).export(
        organizationFrom(search),
        filterFrom(search),
        AUDIT_EXPORT_LIMIT
      )
      return envelope(options.app, result)
    } catch (cause) {
      if (isHttpError(cause)) {
        return error(cause.status, cause.code, cause.message)
      }
      console.error("[audit] export failed", cause)
      return error(500, "internal_error", "Audit export failed")
    }
  }
}

/**
 * `POST /internal/v1/audit/prune` — delete expired rows for one or more
 * organizations. Copilot sends the retention cutoffs computed from the plan.
 */
export function createAuditPruneHandler(options: AuditHttpOptions) {
  return async function POST(request: Request): Promise<Response> {
    const denied = await authorized(request, options.authorizeWrite)
    if (denied) return denied

    try {
      const body = AuditPruneRequestSchema.parse(await request.json())
      const reader = readerFor(options)
      const result = {
        organizations: body.organizations.length,
        deleted: 0,
        capped: 0,
      }
      for (const target of body.organizations) {
        const pruned = await reader.prune(
          target.organizationId,
          new Date(target.before),
          { batchSize: body.batchSize, maxBatches: body.maxBatches }
        )
        result.deleted += pruned.deleted
        if (pruned.capped) result.capped += 1
      }
      return envelope(options.app, result)
    } catch (cause) {
      if (isHttpError(cause)) {
        return error(cause.status, cause.code, cause.message)
      }
      if (cause instanceof SyntaxError) {
        return error(400, "validation_error", "Invalid JSON body")
      }
      const parsed =
        typeof cause === "object" && cause !== null && "issues" in cause
      if (parsed) {
        return error(400, "validation_error", "Invalid prune request")
      }
      console.error("[audit] prune failed", cause)
      return error(500, "internal_error", "Audit prune failed")
    }
  }
}
