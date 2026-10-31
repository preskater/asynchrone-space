import { internalAudience } from "../apps"
import {
  INTERNAL_ROUTES,
  InternalErrorSchema,
  NotificationInputSchema,
  NotificationResultSchema,
  SERVICE_SCOPES,
  type NotificationInput,
  type NotificationResult,
} from "../internal/contracts"

/**
 * Typed client for Copilot's notification ingress.
 *
 * Domain apps retry failed notifications with the same idempotency key; the
 * receiver creates the row once.
 */
export interface NotificationClientOptions {
  /** Copilot origin. */
  baseUrl: string
  getToken: (request: { audience: string; scopes: string[] }) => Promise<string>
  fetchImpl?: typeof fetch
}

export class NotificationClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "NotificationClientError"
    this.code = code
    this.status = status
  }
}

export class NotificationClient {
  private readonly options: NotificationClientOptions
  private readonly audience = internalAudience("copilot")

  constructor(options: NotificationClientOptions) {
    this.options = { fetchImpl: fetch, ...options }
  }

  async create(input: NotificationInput): Promise<NotificationResult> {
    const response = await (this.options.fetchImpl ?? fetch)(
      new URL(INTERNAL_ROUTES.notifications, this.options.baseUrl),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${await this.options.getToken({
            audience: this.audience,
            scopes: [SERVICE_SCOPES.notificationsWrite],
          })}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(NotificationInputSchema.parse(input)),
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
      throw new NotificationClientError(
        parsed.success ? parsed.data.code : "notification_request_failed",
        parsed.success
          ? parsed.data.message
          : `Notification API returned ${response.status}`,
        response.status
      )
    }
    if (!body || typeof body !== "object" || !("data" in body)) {
      throw new NotificationClientError(
        "invalid_response",
        "Notification API response has no data",
        502
      )
    }
    return NotificationResultSchema.parse((body as { data: unknown }).data)
  }
}
