"use server"

import { z } from "zod"

import { withAction } from "@workspace/core/action"

import { getRequestContext, requirePermission } from "@/lib/core/auth-context"
import { parseLocalized } from "@/lib/core/validation-server"
import {
  createWebhookSubscription,
  createWebhookSubscriptionSchema,
  deleteWebhookSubscription,
  listWebhookDeliveries,
  replayWebhookDelivery,
  updateWebhookSubscription,
  updateWebhookSubscriptionSchema,
} from "@/lib/webhooks"

const listWebhookDeliveriesSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).nullable().optional(),
  subscriptionId: z.string().min(1).nullable().optional(),
  status: z.enum(["pending", "succeeded", "failed"]).nullable().optional(),
})

export const createWebhookSubscriptionAction = withAction(
  async (input: unknown) => {
    const ctx = await getRequestContext()
    requirePermission(ctx, "member:manage")
    const parsed = await parseLocalized(createWebhookSubscriptionSchema, input)
    return createWebhookSubscription(ctx, parsed)
  }
)

export const updateWebhookSubscriptionAction = withAction(
  async (input: unknown) => {
    const ctx = await getRequestContext()
    requirePermission(ctx, "member:manage")
    const parsed = await parseLocalized(updateWebhookSubscriptionSchema, input)
    return updateWebhookSubscription(ctx, parsed)
  }
)

export const deleteWebhookSubscriptionAction = withAction(
  async (id: string) => {
    const ctx = await getRequestContext()
    requirePermission(ctx, "member:manage")
    return deleteWebhookSubscription(ctx, z.string().min(1).parse(id))
  }
)

export const listWebhookDeliveriesAction = withAction(
  async (input: unknown) => {
    const ctx = await getRequestContext()
    requirePermission(ctx, "member:manage")
    const parsed = await parseLocalized(listWebhookDeliveriesSchema, input)
    return listWebhookDeliveries(ctx, {
      limit: parsed.limit,
      cursor: parsed.cursor ?? undefined,
      subscriptionId: parsed.subscriptionId ?? undefined,
      status: parsed.status ?? undefined,
    })
  }
)

export const replayWebhookDeliveryAction = withAction(async (id: string) => {
  const ctx = await getRequestContext()
  requirePermission(ctx, "member:manage")
  return replayWebhookDelivery(ctx, z.string().min(1).parse(id))
})
