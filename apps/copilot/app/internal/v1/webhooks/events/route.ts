import {
  INTERNAL_API_VERSION,
  SERVICE_SCOPES,
  WebhookEventEnvelopeSchema,
} from "@workspace/contracts"

import { requireCopilotService } from "@/lib/internal/service"
import { enqueueWebhookEvent } from "@/lib/webhooks/dispatcher"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function envelope(data: unknown, status = 200): Response {
  return Response.json(
    {
      data,
      meta: {
        app: "copilot",
        version: INTERNAL_API_VERSION,
        requestId: crypto.randomUUID(),
      },
    },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}

function error(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}

/**
 * Central webhook event ingress. Domain apps validate the shared envelope and
 * send it here; the receiver fans it out to the organization's active
 * subscriptions. A retry with the same event id is idempotent.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    await requireCopilotService(request, SERVICE_SCOPES.webhooksWrite)
  } catch (cause) {
    const status =
      typeof cause === "object" &&
      cause !== null &&
      typeof (cause as { status?: unknown }).status === "number"
        ? (cause as { status: number }).status
        : 401
    const code =
      typeof cause === "object" &&
      cause !== null &&
      typeof (cause as { code?: unknown }).code === "string"
        ? (cause as { code: string }).code
        : "unauthorized"
    return error(status, code, "A valid service token is required")
  }

  const parsed = WebhookEventEnvelopeSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return error(400, "validation_error", "Invalid webhook event")
  }

  try {
    return envelope({ queued: await enqueueWebhookEvent(parsed.data) })
  } catch (cause) {
    console.error("[webhooks] enqueue failed", cause)
    return error(500, "internal_error", "Webhook event enqueue failed")
  }
}
