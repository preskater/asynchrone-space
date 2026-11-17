import { describe, expect, it } from "vitest"

import {
  WEBHOOK_EVENT_DATA,
  WEBHOOK_EVENTS,
  WebhookEventEnvelopeSchema,
  WebhookEventSchema,
} from "./events"

describe("webhook event catalogue", () => {
  it("has a unique data schema for every event", () => {
    expect(new Set(WEBHOOK_EVENTS).size).toBe(WEBHOOK_EVENTS.length)
    expect(Object.keys(WEBHOOK_EVENT_DATA).sort()).toEqual(
      [...WEBHOOK_EVENTS].sort()
    )
  })

  it("rejects an event outside the catalogue", () => {
    expect(WebhookEventSchema.safeParse("task.archived").success).toBe(false)
    expect(WebhookEventSchema.safeParse("task.created").success).toBe(true)
  })

  it("parses a member event envelope", () => {
    const envelope = {
      id: "evt_1",
      type: "member.added",
      occurredAt: "2026-01-01T00:00:00.000Z",
      organizationId: "org_1",
      data: {
        member: {
          userId: "user_1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
      },
    }
    expect(WebhookEventEnvelopeSchema.parse(envelope)).toMatchObject({
      type: "member.added",
      data: { member: { userId: "user_1" } },
    })
  })

  it("rejects an envelope with the wrong payload for its type", () => {
    expect(
      WebhookEventEnvelopeSchema.safeParse({
        id: "evt_1",
        type: "member.added",
        occurredAt: "2026-01-01T00:00:00.000Z",
        organizationId: "org_1",
        data: { project: {} },
      }).success
    ).toBe(false)
  })
})
