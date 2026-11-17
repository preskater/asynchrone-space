import { beforeEach, describe, expect, it, vi } from "vitest"

import { encodeCursor } from "@workspace/core/pagination"

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  recordUserAudit: vi.fn(async () => undefined),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookDelivery: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}))
vi.mock("@/lib/audit", () => ({
  recordUserAudit: mocks.recordUserAudit,
}))

import { listWebhookDeliveries, replayWebhookDelivery } from "./deliveries"

const ctx = {
  organizationId: "org_1",
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  role: "admin" as const,
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "del_1",
    subscriptionId: "wh_1",
    eventId: "evt_1",
    eventType: "task.created",
    url: "https://example.com/hook",
    status: "failed",
    attempts: 3,
    lastStatusCode: 500,
    lastError: "The endpoint returned 500.",
    nextAttemptAt: new Date("2026-01-01T00:10:00.000Z"),
    replayCount: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: new Date("2026-01-01T00:05:00.000Z"),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("listWebhookDeliveries", () => {
  it("scopes the query and returns the delivery metadata", async () => {
    mocks.findMany.mockResolvedValue([row()])
    const page = await listWebhookDeliveries(ctx, {
      limit: 10,
      status: "failed",
    })

    const call = mocks.findMany.mock.calls[0]![0]
    expect(call.where).toEqual({
      organizationId: "org_1",
      status: "failed",
    })
    expect(call.take).toBe(11)
    expect(call.select).not.toHaveProperty("payload")
    expect(page.items[0]).toMatchObject({
      id: "del_1",
      status: "failed",
      attempts: 3,
      lastStatusCode: 500,
      createdAt: "2026-01-01T00:00:00.000Z",
    })
  })

  it("uses the cursor to page newest first", async () => {
    mocks.findMany.mockResolvedValue([])
    await listWebhookDeliveries(ctx, {
      cursor: encodeCursor(["2026-01-01T00:00:00.000Z", "del_9"]),
    })
    expect(mocks.findMany.mock.calls[0]![0].where.OR).toEqual([
      { createdAt: { lt: new Date("2026-01-01T00:00:00.000Z") } },
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: { lt: "del_9" },
      },
    ])
  })
})

describe("replayWebhookDelivery", () => {
  it("rejects an unknown or cross-organization delivery", async () => {
    mocks.findFirst.mockResolvedValue(null)
    await expect(replayWebhookDelivery(ctx, "del_9")).rejects.toMatchObject({
      code: "not_found",
    })
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "del_9", organizationId: "org_1" },
      select: { id: true, eventType: true, status: true },
    })
  })

  it("refuses a delivery that is not failed", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "del_1",
      eventType: "task.created",
      status: "succeeded",
    })
    await expect(replayWebhookDelivery(ctx, "del_1")).rejects.toMatchObject({
      code: "conflict",
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("resets a failed delivery and audits the replay", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "del_1",
      eventType: "task.created",
      status: "failed",
    })
    mocks.update.mockResolvedValue({ replayCount: 1 })

    await expect(replayWebhookDelivery(ctx, "del_1")).resolves.toEqual({
      id: "del_1",
    })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "del_1" },
      data: expect.objectContaining({
        status: "pending",
        attempts: 0,
        lastStatusCode: null,
        lastError: null,
        completedAt: null,
        replayCount: { increment: 1 },
      }),
      select: { replayCount: true },
    })
    expect(mocks.recordUserAudit).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: "webhook.delivery.replayed",
        entityType: "webhookDelivery",
        entityId: "del_1",
      })
    )
  })
})
