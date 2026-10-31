import { internalAudience, type AppKey } from "../apps"
import {
  INTERNAL_ROUTES,
  InternalErrorSchema,
  SERVICE_SCOPES,
} from "../internal/contracts"
import {
  AuditExportSchema,
  AuditFacetsSchema,
  AuditPageSchema,
  AuditPruneResultSchema,
  type AuditExport,
  type AuditFacets,
  type AuditPage,
  type AuditPruneRequest,
  type AuditPruneResult,
} from "../internal/audit"

/**
 * Typed client for one app's internal audit API.
 *
 * Copilot creates one client per reachable domain app and injects a
 * service-token getter, so this package stays independent from
 * `@workspace/service-auth`. Audit reads are never cached: the trail must be
 * fresh after a mutation.
 */

export interface AuditClientOptions {
  /** Target app, used as the service-token audience. */
  app: AppKey
  /** App origin, e.g. `https://projects.copilot.asynchrone.space`. */
  baseUrl: string
  getToken: (request: { audience: string; scopes: string[] }) => Promise<string>
  fetchImpl?: typeof fetch
}

export class AuditClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "AuditClientError"
    this.code = code
    this.status = status
  }
}

export interface AuditFilterInput {
  actorId?: string
  action?: string
  entityType?: string
  /** `YYYY-MM-DD` UTC day, inclusive. */
  from?: string
  /** `YYYY-MM-DD` UTC day, inclusive. */
  to?: string
}

export interface AuditPageQuery extends AuditFilterInput {
  cursor?: string | null
  limit?: number | null
}

function queryString(
  organizationId: string,
  input: AuditFilterInput & { cursor?: string | null; limit?: number | null }
): string {
  const search = new URLSearchParams({ organizationId })
  for (const key of [
    "actorId",
    "action",
    "entityType",
    "from",
    "to",
    "cursor",
  ] as const) {
    const value = input[key]
    if (value) search.set(key, value)
  }
  if (input.limit) search.set("limit", String(input.limit))
  return search.toString()
}

export class AuditClient {
  private readonly options: AuditClientOptions
  private readonly audience: string

  constructor(options: AuditClientOptions) {
    this.options = { fetchImpl: fetch, ...options }
    this.audience = internalAudience(options.app)
  }

  private async request(
    path: string,
    init: RequestInit,
    scope: string
  ): Promise<unknown> {
    const response = await (this.options.fetchImpl ?? fetch)(
      new URL(path, this.options.baseUrl),
      {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${await this.options.getToken({
            audience: this.audience,
            scopes: [scope],
          })}`,
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      }
    )
    const body = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      const parsed = InternalErrorSchema.safeParse(
        typeof body === "object" && body && "error" in body
          ? (body as { error: unknown }).error
          : body
      )
      throw new AuditClientError(
        parsed.success ? parsed.data.code : "audit_request_failed",
        parsed.success
          ? parsed.data.message
          : `Audit API returned ${response.status}`,
        response.status
      )
    }
    if (!body || typeof body !== "object" || !("data" in body)) {
      throw new AuditClientError(
        "invalid_response",
        "Audit API response has no data",
        502
      )
    }
    return (body as { data: unknown }).data
  }

  async list(
    organizationId: string,
    input: AuditPageQuery = {}
  ): Promise<AuditPage> {
    return AuditPageSchema.parse(
      await this.request(
        `${INTERNAL_ROUTES.audit}?${queryString(organizationId, input)}`,
        { method: "GET" },
        SERVICE_SCOPES.auditRead
      )
    )
  }

  async facets(
    organizationId: string,
    options: { since?: string } = {}
  ): Promise<AuditFacets> {
    const search = new URLSearchParams({ organizationId })
    if (options.since) search.set("since", options.since)
    return AuditFacetsSchema.parse(
      await this.request(
        `${INTERNAL_ROUTES.auditFacets}?${search}`,
        { method: "GET" },
        SERVICE_SCOPES.auditRead
      )
    )
  }

  async export(
    organizationId: string,
    input: AuditFilterInput = {}
  ): Promise<AuditExport> {
    return AuditExportSchema.parse(
      await this.request(
        `${INTERNAL_ROUTES.auditExport}?${queryString(organizationId, input)}`,
        { method: "GET" },
        SERVICE_SCOPES.auditRead
      )
    )
  }

  async prune(request: AuditPruneRequest): Promise<AuditPruneResult> {
    return AuditPruneResultSchema.parse(
      await this.request(
        INTERNAL_ROUTES.auditPrune,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        },
        SERVICE_SCOPES.auditWrite
      )
    )
  }
}
