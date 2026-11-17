import { z } from "zod"

import { WebhookEventSchema } from "@workspace/contracts"

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().trim().url().max(2000),
  description: z.string().trim().max(200).nullable().optional(),
  events: z.array(WebhookEventSchema).min(1),
  active: z.boolean().optional(),
})
export type CreateWebhookSubscriptionInput = z.infer<
  typeof createWebhookSubscriptionSchema
>

export const updateWebhookSubscriptionSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().trim().url().max(2000).optional(),
    description: z.string().trim().max(200).nullable().optional(),
    events: z.array(WebhookEventSchema).min(1).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "At least one field is required.",
  })
export type UpdateWebhookSubscriptionInput = z.infer<
  typeof updateWebhookSubscriptionSchema
>
