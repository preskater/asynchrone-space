import { createHmac } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  subscriptionFindMany: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  deliveryCreateMany: vi.fn(),
  deliveryUpdate: vi.fn(),
  deliveryDeleteMany: vi.fn(),
  queryRaw: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookSubscription: {
      findMany: mocks.subscriptionFindMany,
      findUnique: mocks.subscriptionFindUnique,
    },
    webhookDelivery: {
      createMany: mocks.deliveryCreateMany,
      update: mocks.deliveryUpdate,
      deleteMany: mocks.deliveryDeleteMany,
    },
    $queryRaw: mocks.queryRaw,
  },
}))
vi.mock("./secrets", () => ({
  decryptWebhookSecret: () => "webhook-secret",
}))
vi.mock("./url-safety", () => ({
  assertSafeWebhookUrl: async (url: string) => new URL(url),
}))

import {
  dispatchPendingDeliveries,
  enqueueWebhookEvent,
  pruneWebhookDeliveries,
  WEBHOOK_DELIVERY_RETENTION_DAYS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
} from "./dispatcher"

const envelope = {
  id: "evt_1",
  type: "member.added" as const,
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

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    id: "del_1",
    organizationId: "org_1",
    subscriptionId: "wh_1",
    eventType: "member.added",
    payload: envelope,
    url: "https://example.com/hook",
    attempts: 1,
    ...overrides,
  }
}

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  mocks.queryRaw.mockResolvedValue([])
  mocks.subscriptionFindUnique.mockResolvedValue({
    url: "https://example.com/hook",
    secret: "enc:secret",
    active: true,
    deletedAt: null,
  })
  mocks.deliveryUpdate.mockResolvedValue({})
  mocks.deliveryCreateMany.mockResolvedValue({ count: 0 })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("enqueueWebhookEvent", () => {
  it("fans out one delivery per matching active subscription", async () => {
    mocks.subscriptionFindMany.mockResolvedValue([
      { id: "wh_1", url: "https://example.com/a" },
      { id: "wh_2", url: "https://example.com/b" },
    ])
    mocks.deliveryCreateMany.mockResolvedValue({ count: 2 })

    await expect(enqueueWebhookEvent(envelope)).resolves.toBe(2)

    expect(mocks.subscriptionFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        active: true,
        deletedAt: null,
        events: { has: "member.added" },
      },
      select: { id: true, url: true },
    })
    const data = mocks.deliveryCreateMany.mock.calls[0]![0].data as {
      subscriptionId: string
      eventId: string
      eventType: string
      payload: unknown
      url: string
    }[]
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      subscriptionId: "wh_1",
      eventId: "evt_1",
      eventType: "member.added",
      payload: envelope,
      url: "https://example.com/a",
    })
    expect(mocks.deliveryCreateMany.mock.calls[0]![0].skipDuplicates).toBe(true)
  })

  it("does nothing when no subscription selected the event", async () => {
    mocks.subscriptionFindMany.mockResolvedValue([])
    await expect(enqueueWebhookEvent(envelope)).resolves.toBe(0)
    expect(mocks.deliveryCreateMany).not.toHaveBeenCalled()
  })
})

describe("dispatchPendingDeliveries", () => {
  it("sends the exact signed payload with the delivery headers", async () => {
    mocks.queryRaw.mockResolvedValue([delivery()])

    const result = await dispatchPendingDeliveries()
    expect(result).toEqual({
      claimed: 1,
      succeeded: 1,
      failed: 0,
      retrying: 0,
    })

    const [url, init] = fetchMock.mock.calls[0]! as unknown as [
      URL,
      RequestInit,
    ]
    expect(url.toString()).toBe("https://example.com/hook")
    const body = init.body as string
    expect(body).toBe(JSON.stringify(envelope))
    const headers = init.headers as Record<string, string>
    const expected = createHmac("sha256", "webhook-secret")
      .update(body, "utf8")
      .digest("hex")
    expect(headers["X-Asynchrone-Signature"]).toBe(`sha256=${expected}`)
    expect(headers["X-Asynchrone-Delivery"]).toBe("del_1")
    expect(headers["X-Asynchrone-Event"]).toBe("member.added")
    expect(headers["X-Asynchrone-Timestamp"]).toMatch(/^\d+$/)
    expect(init.redirect).toBe("manual")
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "del_1" },
      data: expect.objectContaining({ status: "succeeded" }),
    })
  })

  it("schedules a retry with the first backoff on a 500", async () => {
    mocks.queryRaw.mockResolvedValue([delivery({ attempts: 1 })])
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 500 }))

    const result = await dispatchPendingDeliveries()
    expect(result.retrying).toBe(1)

    const data = mocks.deliveryUpdate.mock.calls[0]![0].data
    expect(data.status).toBeUndefined()
    expect(data.lastStatusCode).toBe(500)
    expect(data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      Date.now() + WEBHOOK_RETRY_DELAYS_MS[0]! - 1_000
    )
  })

  it("stops retrying after the maximum attempts", async () => {
    mocks.queryRaw.mockResolvedValue([
      delivery({ attempts: WEBHOOK_MAX_ATTEMPTS }),
    ])
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 500 }))

    await dispatchPendingDeliveries()
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "del_1" },
      data: expect.objectContaining({
        status: "failed",
        lastStatusCode: 500,
      }),
    })
  })

  it("stops on 410 even before the maximum attempts", async () => {
    mocks.queryRaw.mockResolvedValue([delivery({ attempts: 1 })])
    fetchMock.mockResolvedValueOnce(new Response("gone", { status: 410 }))

    await dispatchPendingDeliveries()
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "del_1" },
      data: expect.objectContaining({ status: "failed", lastStatusCode: 410 }),
    })
  })

  it("fails an inactive subscription without sending", async () => {
    mocks.queryRaw.mockResolvedValue([delivery()])
    mocks.subscriptionFindUnique.mockResolvedValue({
      url: "https://example.com/hook",
      secret: "enc:secret",
      active: false,
      deletedAt: null,
    })

    await dispatchPendingDeliveries()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "del_1" },
      data: expect.objectContaining({
        status: "failed",
        lastError: "The subscription is inactive.",
      }),
    })
  })

  it("records a transport error and retries", async () => {
    mocks.queryRaw.mockResolvedValue([delivery({ attempts: 1 })])
    fetchMock.mockRejectedValueOnce(new Error("timed out"))

    const result = await dispatchPendingDeliveries()
    expect(result.retrying).toBe(1)
    expect(mocks.deliveryUpdate.mock.calls[0]![0].data.lastError).toBe(
      "timed out"
    )
  })
})

describe("pruneWebhookDeliveries", () => {
  it("deletes rows past the retention window", async () => {
    mocks.deliveryDeleteMany.mockResolvedValue({ count: 3 })
    const now = new Date("2026-06-01T00:00:00.000Z")
    await expect(pruneWebhookDeliveries(now)).resolves.toBe(3)
    const cutoff = new Date(
      now.getTime() - WEBHOOK_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000
    )
    expect(mocks.deliveryDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cutoff } },
    })
  })
})
