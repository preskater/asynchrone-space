import { internalAudience, type AppKey } from "../apps"
import {
  INTERNAL_ROUTES,
  InternalErrorSchema,
  SERVICE_SCOPES,
  DeletionResultSchema,
  ExportPartSchema,
  type DeletionResult,
  type ExportPart,
} from "../internal/contracts"

/**
 * Typed client for a domain app's saga endpoints.
 *
 * Deletion is idempotent: a retry after a partial failure must not undo rows
 * that were already removed, and the target app reports the same result.
 */
export interface SagaClientOptions {
  app: AppKey
  baseUrl: string
  getToken: (request: { audience: string; scopes: string[] }) => Promise<string>
  fetchImpl?: typeof fetch
}

export class SagaClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "SagaClientError"
    this.code = code
    this.status = status
  }
}

export class SagaClient {
  private readonly options: SagaClientOptions
  private readonly audience: string

  constructor(options: SagaClientOptions) {
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
      throw new SagaClientError(
        parsed.success ? parsed.data.code : "saga_request_failed",
        parsed.success
          ? parsed.data.message
          : `Saga API returned ${response.status}`,
        response.status
      )
    }
    if (!body || typeof body !== "object" || !("data" in body)) {
      throw new SagaClientError(
        "invalid_response",
        "Saga API response has no data",
        502
      )
    }
    return (body as { data: unknown }).data
  }

  async exportOrganization(organizationId: string): Promise<ExportPart> {
    return ExportPartSchema.parse(
      await this.request(
        INTERNAL_ROUTES.exportOrganization(encodeURIComponent(organizationId)),
        { method: "GET" },
        SERVICE_SCOPES.exportRead
      )
    )
  }

  async deleteOrganization(organizationId: string): Promise<DeletionResult> {
    return DeletionResultSchema.parse(
      await this.request(
        INTERNAL_ROUTES.deleteOrganization(encodeURIComponent(organizationId)),
        { method: "DELETE" },
        SERVICE_SCOPES.deleteWrite
      )
    )
  }

  async deleteUser(userId: string): Promise<DeletionResult> {
    return DeletionResultSchema.parse(
      await this.request(
        INTERNAL_ROUTES.deleteUser(encodeURIComponent(userId)),
        { method: "DELETE" },
        SERVICE_SCOPES.deleteWrite
      )
    )
  }
}
