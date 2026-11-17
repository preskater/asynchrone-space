import { createHmac } from "node:crypto"

import {
  WebhookEventEnvelopeSchema,
  type WebhookEventEnvelope,
} from "@workspace/contracts"
import type { Prisma } from "@workspace/db-identity"

import { prisma } from "@/lib/prisma"

import { decryptWebhookSecret } from "./secrets"
import { assertSafeWebhookUrl } from "./url-safety"

/** Initial attempt plus six retries. */
export const WEBHOOK_MAX_ATTEMPTS = 7
export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  8 * 60 * 60_000,
  24 * 60 * 60_000,
]
export const WEBHOOK_DELIVERY_RETENTION_DAYS = 30

const BATCH_SIZE = 20
const TIMEOUT_MS = 10_000
const MAX_ERROR_LENGTH = 500

export interface DeliveryRow {
  id: string
  organizationId: string
  subscriptionId: string
  eventType: string
  payload: unknown
  url: string
  attempts: number
}

/** Creates one pending delivery per active subscription that selected the event. */
export async function enqueueWebhookEvent(
  envelope: WebhookEventEnvelope
): Promise<number> {
  const event = WebhookEventEnvelopeSchema.parse(envelope)
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      organizationId: event.organizationId,
      active: true,
      deletedAt: null,
      events: { has: event.type },
    },
    select: { id: true, url: true },
  })
  if (subscriptions.length === 0) return 0

  const result = await prisma.webhookDelivery.createMany({
    data: subscriptions.map((subscription) => ({
      organizationId: event.organizationId,
      subscriptionId: subscription.id,
      eventId: event.id,
      eventType: event.type,
      payload: event as unknown as Prisma.InputJsonValue,
      url: subscription.url,
      status: "pending",
      nextAttemptAt: new Date(),
    })),
    skipDuplicates: true,
  })
  return result.count
}

/**
 * Claims due deliveries with a lease. `SKIP LOCKED` keeps concurrent replicas
 * from processing the same row; a crashed run is retried when the lease ends.
 */
export async function claimDueDeliveries(
  limit = BATCH_SIZE
): Promise<DeliveryRow[]> {
  return prisma.$queryRaw<DeliveryRow[]>`
    UPDATE "webhookDelivery"
    SET "nextAttemptAt" = now() + interval '5 minutes',
        "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "webhookDelivery"
      WHERE "status" = 'pending' AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "organizationId", "subscriptionId", "eventType", "payload", "url", "attempts"
  `
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex")
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAX_ERROR_LENGTH)
}

type AttemptResult = "succeeded" | "failed" | "retry"

async function fail(
  delivery: DeliveryRow,
  statusCode: number | null,
  error: string,
  permanent: boolean
): Promise<AttemptResult> {
  if (permanent) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "failed",
        lastStatusCode: statusCode,
        lastError: error.slice(0, MAX_ERROR_LENGTH),
        completedAt: new Date(),
      },
    })
    return "failed"
  }
  const delay =
    WEBHOOK_RETRY_DELAYS_MS[delivery.attempts - 1] ??
    WEBHOOK_RETRY_DELAYS_MS[WEBHOOK_RETRY_DELAYS_MS.length - 1]!
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      lastStatusCode: statusCode,
      lastError: error.slice(0, MAX_ERROR_LENGTH),
      nextAttemptAt: new Date(Date.now() + delay),
    },
  })
  return "retry"
}

async function deliver(delivery: DeliveryRow): Promise<AttemptResult> {
  const subscription = await prisma.webhookSubscription.findUnique({
    where: { id: delivery.subscriptionId },
    select: { url: true, secret: true, active: true, deletedAt: true },
  })
  if (!subscription || subscription.deletedAt || !subscription.active) {
    return fail(delivery, null, "The subscription is inactive.", true)
  }

  try {
    const url = await assertSafeWebhookUrl(subscription.url)
    const secret = decryptWebhookSecret(subscription.secret)
    const body = JSON.stringify(delivery.payload)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Asynchrone-Webhooks/1.0",
        "X-Asynchrone-Signature": `sha256=${sign(secret, body)}`,
        "X-Asynchrone-Delivery": delivery.id,
        "X-Asynchrone-Event": delivery.eventType,
        "X-Asynchrone-Timestamp": String(Math.floor(Date.now() / 1000)),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })
    // The receiver's body is never buffered by us.
    try {
      await response.body?.cancel()
    } catch {
      // Ignore a body that closes itself.
    }

    if (response.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "succeeded",
          lastStatusCode: response.status,
          lastError: null,
          completedAt: new Date(),
        },
      })
      return "succeeded"
    }

    const permanent =
      response.status === 410 || delivery.attempts >= WEBHOOK_MAX_ATTEMPTS
    return fail(
      delivery,
      response.status,
      `The endpoint returned ${response.status}.`,
      permanent
    )
  } catch (error) {
    return fail(
      delivery,
      null,
      errorMessage(error),
      delivery.attempts >= WEBHOOK_MAX_ATTEMPTS
    )
  }
}

export interface DispatchResult {
  claimed: number
  succeeded: number
  failed: number
  retrying: number
}

/** Processes one bounded batch; the cron runs this every minute. */
export async function dispatchPendingDeliveries(): Promise<DispatchResult> {
  const deliveries = await claimDueDeliveries()
  let succeeded = 0
  let failed = 0
  let retrying = 0
  for (const delivery of deliveries) {
    const result = await deliver(delivery)
    if (result === "succeeded") succeeded += 1
    else if (result === "failed") failed += 1
    else retrying += 1
  }
  return { claimed: deliveries.length, succeeded, failed, retrying }
}

/** Deletes delivery rows past the retention window. */
export async function pruneWebhookDeliveries(
  now = new Date()
): Promise<number> {
  const cutoff = new Date(
    now.getTime() - WEBHOOK_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  )
  const result = await prisma.webhookDelivery.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return result.count
}
