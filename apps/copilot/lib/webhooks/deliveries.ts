import type { RequestContext } from "@workspace/core/context"
import { ConflictError, NotFoundError } from "@workspace/core/errors"
import {
  decodeCursor,
  encodeCursor,
  pageSize,
  toPage,
  type Page,
  type PageInput,
} from "@workspace/core/pagination"

import { recordUserAudit } from "@/lib/audit"
import { AUDIT_ACTIONS } from "@/lib/audit/actions"
import { prisma } from "@/lib/prisma"

import type { WebhookDeliveryStatus, WebhookDeliverySummary } from "./types"

const DELIVERY_SELECT = {
  id: true,
  subscriptionId: true,
  eventId: true,
  eventType: true,
  url: true,
  status: true,
  attempts: true,
  lastStatusCode: true,
  lastError: true,
  nextAttemptAt: true,
  replayCount: true,
  createdAt: true,
  completedAt: true,
} as const

type DeliveryRow = {
  id: string
  subscriptionId: string
  eventId: string
  eventType: string
  url: string
  status: string
  attempts: number
  lastStatusCode: number | null
  lastError: string | null
  nextAttemptAt: Date
  replayCount: number
  createdAt: Date
  completedAt: Date | null
}

function summary(row: DeliveryRow): WebhookDeliverySummary {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    eventId: row.eventId,
    eventType: row.eventType,
    url: row.url,
    status: row.status as WebhookDeliveryStatus,
    attempts: row.attempts,
    lastStatusCode: row.lastStatusCode,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    replayCount: row.replayCount,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}

/** Newest first, optionally narrowed to one subscription or status. */
export async function listWebhookDeliveries(
  ctx: Pick<RequestContext, "organizationId">,
  input: PageInput & {
    subscriptionId?: string
    status?: WebhookDeliveryStatus
  } = {}
): Promise<Page<WebhookDeliverySummary>> {
  const limit = pageSize(input.limit)
  const decoded = decodeCursor(input.cursor)
  const after =
    decoded && decoded[0] && decoded[1]
      ? { createdAt: new Date(decoded[0]), id: decoded[1] }
      : null

  const rows = await prisma.webhookDelivery.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(input.subscriptionId ? { subscriptionId: input.subscriptionId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: DELIVERY_SELECT,
    take: limit + 1,
  })

  const page = toPage(rows, limit, (row) =>
    encodeCursor([row.createdAt.toISOString(), row.id])
  )
  return {
    items: page.items.map(summary),
    nextCursor: page.nextCursor,
  }
}

/** Only failed deliveries are replayable; the cron picks the reset row up. */
export async function replayWebhookDelivery(
  ctx: Pick<
    RequestContext,
    "organizationId" | "userId" | "userName" | "userEmail" | "actor"
  >,
  id: string
): Promise<{ id: string }> {
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true, eventType: true, status: true },
  })
  if (!delivery) throw new NotFoundError("Webhook delivery")
  if (delivery.status !== "failed") {
    throw new ConflictError("Only failed deliveries can be replayed.")
  }

  const updated = await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
      lastStatusCode: null,
      lastError: null,
      completedAt: null,
      replayCount: { increment: 1 },
    },
    select: { replayCount: true },
  })

  await recordUserAudit(ctx, {
    action: AUDIT_ACTIONS.webhookDeliveryReplayed,
    entityType: "webhookDelivery",
    entityId: delivery.id,
    entityLabel: delivery.eventType,
    after: { replayCount: updated.replayCount },
  })

  return { id: delivery.id }
}
