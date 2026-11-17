import { z } from "zod"

import {
  PublicClientSchema,
  PublicContactSchema,
  PublicDealSchema,
  PublicProjectSchema,
  PublicTaskSchema,
} from "./resources"

/**
 * Outbound webhook event catalogue. A subscription selects a subset; the
 * dispatcher delivers one `WebhookEventEnvelope` per matching event.
 */
export const WEBHOOK_EVENTS = [
  "project.created",
  "project.updated",
  "project.deleted",
  "task.created",
  "task.updated",
  "task.deleted",
  "client.created",
  "client.updated",
  "contact.created",
  "contact.updated",
  "deal.created",
  "deal.updated",
  "deal.stage_changed",
  "member.added",
  "member.removed",
] as const

export const WebhookEventSchema = z.enum(WEBHOOK_EVENTS)
export type WebhookEvent = z.infer<typeof WebhookEventSchema>

export const WebhookMemberSchema = z.object({
  userId: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  role: z.string().min(1),
})
export type WebhookMember = z.infer<typeof WebhookMemberSchema>

/** The event-specific `data` payload. */
export const WEBHOOK_EVENT_DATA = {
  "project.created": z.object({ project: PublicProjectSchema }),
  "project.updated": z.object({ project: PublicProjectSchema }),
  "project.deleted": z.object({ project: PublicProjectSchema }),
  "task.created": z.object({ task: PublicTaskSchema }),
  "task.updated": z.object({ task: PublicTaskSchema }),
  "task.deleted": z.object({ task: PublicTaskSchema }),
  "client.created": z.object({ client: PublicClientSchema }),
  "client.updated": z.object({ client: PublicClientSchema }),
  "contact.created": z.object({ contact: PublicContactSchema }),
  "contact.updated": z.object({ contact: PublicContactSchema }),
  "deal.created": z.object({ deal: PublicDealSchema }),
  "deal.updated": z.object({ deal: PublicDealSchema }),
  "deal.stage_changed": z.object({
    deal: PublicDealSchema,
    previousStageId: z.string().min(1).nullable(),
    previousStageName: z.string().nullable(),
  }),
  "member.added": z.object({ member: WebhookMemberSchema }),
  "member.removed": z.object({ member: WebhookMemberSchema }),
} as const satisfies Record<WebhookEvent, z.ZodType>

export type WebhookEventDataByType = {
  [Event in WebhookEvent]: z.infer<(typeof WEBHOOK_EVENT_DATA)[Event]>
}
export type WebhookEventData = WebhookEventDataByType[WebhookEvent]

export type WebhookEventEnvelope = {
  [Event in WebhookEvent]: {
    id: string
    type: Event
    occurredAt: string
    organizationId: string
    data: WebhookEventDataByType[Event]
  }
}[WebhookEvent]

export const WebhookEventEnvelopeSchema = z.union(
  WEBHOOK_EVENTS.map((type) =>
    z.object({
      id: z.string().min(1),
      type: z.literal(type),
      occurredAt: z.string().datetime(),
      organizationId: z.string().min(1),
      data: WEBHOOK_EVENT_DATA[type],
    })
  ) as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
) as unknown as z.ZodType<WebhookEventEnvelope>
