import { internalAudience } from "../apps"
import {
  INTERNAL_ROUTES,
  InternalErrorSchema,
  SERVICE_SCOPES,
  WebhookEmitResultSchema,
  type WebhookEmitResult,
} from "../internal/contracts"
import {
  WebhookEventEnvelopeSchema,
  type WebhookEventEnvelope,
} from "../public-api/events"

/**
 * Typed client for Copilot's webhook event ingress.
 *
 * The emitting app validates the envelope against the shared catalogue before
 * sending; the receiver fans it out to the organization's active
 * subscriptions. The same event id makes a retry idempotent.
 */
export interface WebhookClientOptions {
  baseUrl: string
  getToken: (request: { audience: string; scopes: string[] }) => Promise<string>
  fetchImpl?: typeof fetch
}

export class WebhookClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "WebhookClientError"
    this.code = code
    this.status = status
  }
}

export class WebhookClient {
  private readonly options: WebhookClientOptions
  private readonly audience = internalAudience("copilot")

  constructor(options: WebhookClientOptions) {
    this.options = { fetchImpl: fetch, ...options }
  }

  async emit(event: WebhookEventEnvelope): Promise<WebhookEmitResult> {
    const body = WebhookEventEnvelopeSchema.parse(event)
    const token = await this.options.getToken({
      audience: this.audience,
      scopes: [SERVICE_SCOPES.webhooksWrite],
    })
    const response = await (this.options.fetchImpl ?? fetch)(
      new URL(INTERNAL_ROUTES.webhookEvents, this.options.baseUrl),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      }
    )
    const payload = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      const parsed = InternalErrorSchema.safeParse(
        typeof payload === "object" && payload && "error" in payload
          ? (payload as { error: unknown }).error
          : payload
      )
      throw new WebhookClientError(
        parsed.success ? parsed.data.code : "webhook_emit_failed",
        parsed.success
          ? parsed.data.message
          : `Webhook ingress returned ${response.status}`,
        response.status
      )
    }
    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      throw new WebhookClientError(
        "invalid_response",
        "Webhook ingress response has no data",
        502
      )
    }
    return WebhookEmitResultSchema.parse((payload as { data: unknown }).data)
  }
}
