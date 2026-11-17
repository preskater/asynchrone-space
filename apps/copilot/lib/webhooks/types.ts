import type { WebhookEvent } from "@workspace/contracts"

/** A subscription as listed in settings; never contains the secret. */
export interface WebhookSubscriptionSummary {
  id: string
  url: string
  description: string | null
  events: WebhookEvent[]
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Returned once, immediately after creation. */
export interface CreatedWebhookSubscription {
  secret: string
  item: WebhookSubscriptionSummary
}

export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed"

/** One delivery as listed in the log; never contains the payload. */
export interface WebhookDeliverySummary {
  id: string
  subscriptionId: string
  eventId: string
  eventType: string
  url: string
  status: WebhookDeliveryStatus
  attempts: number
  lastStatusCode: number | null
  lastError: string | null
  nextAttemptAt: string
  replayCount: number
  createdAt: string
  completedAt: string | null
}
