import { WebhookEventSchema, type WebhookEvent } from "@workspace/contracts"
import type { RequestContext } from "@workspace/core/context"
import { ConflictError, NotFoundError } from "@workspace/core/errors"

import { recordUserAudit } from "@/lib/audit"
import { AUDIT_ACTIONS } from "@/lib/audit/actions"
import { requireEntitlement } from "@/lib/organization/entitlements"
import { prisma } from "@/lib/prisma"

import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
} from "./schemas"
import { encryptWebhookSecret, generateWebhookSigningSecret } from "./secrets"
import type {
  CreatedWebhookSubscription,
  WebhookSubscriptionSummary,
} from "./types"
import { assertSafeWebhookUrl } from "./url-safety"

/** One workspace can keep this many active endpoints at once. */
export const MAX_WEBHOOK_SUBSCRIPTIONS = 20

type AuditContext = Pick<
  RequestContext,
  "organizationId" | "userId" | "userName" | "userEmail" | "actor"
>

const SUMMARY_SELECT = {
  id: true,
  url: true,
  description: true,
  events: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

type SubscriptionRow = {
  id: string
  url: string
  description: string | null
  events: string[]
  active: boolean
  createdAt: Date
  updatedAt: Date
}

function summary(row: SubscriptionRow): WebhookSubscriptionSummary {
  return {
    id: row.id,
    url: row.url,
    description: row.description,
    events: row.events as WebhookEvent[],
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function normalizeEvents(events: string[]): WebhookEvent[] {
  return [...new Set(events)].map((event) => WebhookEventSchema.parse(event))
}

function auditPayload(row: SubscriptionRow) {
  return {
    url: row.url,
    events: row.events,
    active: row.active,
    description: row.description,
  }
}

/**
 * Creates an endpoint and returns the signing secret exactly once. Only the
 * encrypted secret is stored; the settings list never selects it.
 */
export async function createWebhookSubscription(
  ctx: AuditContext,
  input: CreateWebhookSubscriptionInput
): Promise<CreatedWebhookSubscription> {
  await requireEntitlement(ctx.organizationId, "apiAccess")

  const url = (await assertSafeWebhookUrl(input.url)).toString()
  const events = normalizeEvents(input.events)

  const duplicate = await prisma.webhookSubscription.findFirst({
    where: { organizationId: ctx.organizationId, url, deletedAt: null },
    select: { id: true },
  })
  if (duplicate) {
    throw new ConflictError("An endpoint with this URL already exists.")
  }

  const count = await prisma.webhookSubscription.count({
    where: { organizationId: ctx.organizationId, deletedAt: null },
  })
  if (count >= MAX_WEBHOOK_SUBSCRIPTIONS) {
    throw new ConflictError(
      `A workspace can have at most ${MAX_WEBHOOK_SUBSCRIPTIONS} webhook endpoints.`
    )
  }

  const secret = generateWebhookSigningSecret()
  const row = await prisma.webhookSubscription.create({
    data: {
      organizationId: ctx.organizationId,
      url,
      secret: encryptWebhookSecret(secret),
      events,
      description: input.description ?? null,
      active: input.active ?? true,
      createdById: ctx.userId,
    },
    select: SUMMARY_SELECT,
  })

  await recordUserAudit(ctx, {
    action: AUDIT_ACTIONS.webhookSubscriptionCreated,
    entityType: "webhookSubscription",
    entityId: row.id,
    entityLabel: row.url,
    after: auditPayload(row),
  })

  return { secret, item: summary(row) }
}

/** Active endpoints, most recent first; soft-deleted rows are hidden. */
export async function listWebhookSubscriptions(
  ctx: Pick<RequestContext, "organizationId">
): Promise<WebhookSubscriptionSummary[]> {
  const rows = await prisma.webhookSubscription.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map(summary)
}

export async function updateWebhookSubscription(
  ctx: AuditContext,
  input: UpdateWebhookSubscriptionInput
): Promise<WebhookSubscriptionSummary> {
  const existing = await prisma.webhookSubscription.findFirst({
    where: {
      id: input.id,
      organizationId: ctx.organizationId,
      deletedAt: null,
    },
    select: SUMMARY_SELECT,
  })
  if (!existing) throw new NotFoundError("Webhook endpoint")

  const url =
    input.url === undefined
      ? existing.url
      : (await assertSafeWebhookUrl(input.url)).toString()
  if (url !== existing.url) {
    const duplicate = await prisma.webhookSubscription.findFirst({
      where: {
        organizationId: ctx.organizationId,
        url,
        deletedAt: null,
        NOT: { id: existing.id },
      },
      select: { id: true },
    })
    if (duplicate) {
      throw new ConflictError("An endpoint with this URL already exists.")
    }
  }

  const row = await prisma.webhookSubscription.update({
    where: { id: existing.id },
    data: {
      ...(input.url === undefined ? {} : { url }),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      ...(input.events === undefined
        ? {}
        : { events: normalizeEvents(input.events) }),
      ...(input.active === undefined ? {} : { active: input.active }),
    },
    select: SUMMARY_SELECT,
  })

  await recordUserAudit(ctx, {
    action: AUDIT_ACTIONS.webhookSubscriptionUpdated,
    entityType: "webhookSubscription",
    entityId: row.id,
    entityLabel: row.url,
    before: auditPayload(existing),
    after: auditPayload(row),
  })

  return summary(row)
}

/** Soft deletion keeps the delivery history that sub-issue 7 will add. */
export async function deleteWebhookSubscription(
  ctx: AuditContext,
  id: string
): Promise<{ id: string }> {
  const existing = await prisma.webhookSubscription.findFirst({
    where: { id, organizationId: ctx.organizationId, deletedAt: null },
    select: SUMMARY_SELECT,
  })
  if (!existing) throw new NotFoundError("Webhook endpoint")

  const deletedAt = new Date()
  await prisma.webhookSubscription.update({
    where: { id: existing.id },
    data: { deletedAt, active: false },
  })

  await recordUserAudit(ctx, {
    action: AUDIT_ACTIONS.webhookSubscriptionDeleted,
    entityType: "webhookSubscription",
    entityId: existing.id,
    entityLabel: existing.url,
    before: auditPayload(existing),
    after: { deletedAt: deletedAt.toISOString() },
  })

  return { id: existing.id }
}
