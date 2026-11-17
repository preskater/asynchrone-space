import {
  WebhookEventEnvelopeSchema,
  type WebhookEvent,
  type WebhookEventData,
} from "@workspace/contracts"

import { enqueueWebhookEvent } from "./dispatcher"

export interface LocalWebhookEvent {
  organizationId: string
  type: WebhookEvent
  data: WebhookEventData
  occurredAt?: Date
}

/**
 * Enqueues an event from Copilot itself (member changes). Failures are logged
 * and never fail the mutation that produced the event.
 */
export async function emitWebhookEvent(
  input: LocalWebhookEvent
): Promise<void> {
  try {
    const envelope = WebhookEventEnvelopeSchema.parse({
      id: crypto.randomUUID(),
      type: input.type,
      occurredAt: (input.occurredAt ?? new Date()).toISOString(),
      organizationId: input.organizationId,
      data: input.data,
    })
    await enqueueWebhookEvent(envelope)
  } catch (error) {
    console.error("[webhooks] local emit failed", error)
  }
}
