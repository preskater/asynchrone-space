import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  recordUserAudit: vi.fn(async () => undefined),
  requireEntitlement: vi.fn(async () => undefined),
  assertSafeWebhookUrl: vi.fn(async (url: string) => new URL(url)),
  generateSecret: vi.fn(() => "raw_secret"),
  encryptSecret: vi.fn((value: string) => `enc:${value}`),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookSubscription: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
      update: mocks.update,
    },
  },
}))
vi.mock("@/lib/audit", () => ({ recordUserAudit: mocks.recordUserAudit }))
vi.mock("@/lib/organization/entitlements", () => ({
  requireEntitlement: mocks.requireEntitlement,
}))
vi.mock("./url-safety", () => ({
  assertSafeWebhookUrl: mocks.assertSafeWebhookUrl,
}))
vi.mock("./secrets", () => ({
  generateWebhookSigningSecret: mocks.generateSecret,
  encryptWebhookSecret: mocks.encryptSecret,
}))

import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookSubscriptions,
  MAX_WEBHOOK_SUBSCRIPTIONS,
  updateWebhookSubscription,
} from "./service"

const ctx = {
  organizationId: "org_1",
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  role: "admin" as const,
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "wh_1",
    url: "https://example.com/hook",
    description: null,
    events: ["task.created"],
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue(null)
  mocks.count.mockResolvedValue(0)
  mocks.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) =>
      row({
        url: data.url,
        description: data.description,
        events: data.events,
        active: data.active,
      })
  )
})

describe("createWebhookSubscription", () => {
  it("stores only the encrypted secret and returns the raw value once", async () => {
    const result = await createWebhookSubscription(ctx, {
      url: "https://example.com/hook",
      description: "Sync",
      events: ["task.created", "task.created", "task.updated"],
      active: true,
    })

    expect(result.secret).toBe("raw_secret")
    expect(result.item.events).toEqual(["task.created", "task.updated"])
    const data = mocks.create.mock.calls[0]![0].data
    expect(data.secret).toBe("enc:raw_secret")
    expect(data.organizationId).toBe("org_1")
    expect(data.createdById).toBe("user_1")
    expect(data.events).toEqual(["task.created", "task.updated"])
    expect(mocks.requireEntitlement).toHaveBeenCalledWith("org_1", "apiAccess")
    expect(mocks.assertSafeWebhookUrl).toHaveBeenCalledWith(
      "https://example.com/hook"
    )
    expect(mocks.recordUserAudit).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: "webhook.subscription.created",
        entityType: "webhookSubscription",
      })
    )
    expect(JSON.stringify(mocks.recordUserAudit.mock.calls[0])).not.toContain(
      "raw_secret"
    )
  })

  it("rejects a duplicate URL and the active-endpoint cap", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "wh_2" })
    await expect(
      createWebhookSubscription(ctx, {
        url: "https://example.com/hook",
        events: ["task.created"],
      })
    ).rejects.toMatchObject({ code: "conflict" })
    expect(mocks.create).not.toHaveBeenCalled()

    mocks.findFirst.mockResolvedValueOnce(null)
    mocks.count.mockResolvedValueOnce(MAX_WEBHOOK_SUBSCRIPTIONS)
    await expect(
      createWebhookSubscription(ctx, {
        url: "https://example.com/other",
        events: ["task.created"],
      })
    ).rejects.toMatchObject({ code: "conflict" })
  })
})

describe("listWebhookSubscriptions", () => {
  it("scopes the query and never selects the secret", async () => {
    mocks.findMany.mockResolvedValue([row()])
    const items = await listWebhookSubscriptions(ctx)

    const call = mocks.findMany.mock.calls[0]![0]
    expect(call.where).toEqual({ organizationId: "org_1", deletedAt: null })
    expect(call.select).not.toHaveProperty("secret")
    expect(items[0]).toMatchObject({
      id: "wh_1",
      createdAt: "2026-01-01T00:00:00.000Z",
      events: ["task.created"],
    })
  })
})

describe("updateWebhookSubscription", () => {
  it("revalidates a changed URL and audits without the secret", async () => {
    mocks.findFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(null)
    mocks.update.mockResolvedValue(
      row({ url: "https://example.com/new", active: false })
    )

    const updated = await updateWebhookSubscription(ctx, {
      id: "wh_1",
      url: "https://example.com/new",
      active: false,
    })

    expect(mocks.assertSafeWebhookUrl).toHaveBeenCalledWith(
      "https://example.com/new"
    )
    expect(updated.url).toBe("https://example.com/new")
    expect(mocks.recordUserAudit).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: "webhook.subscription.updated",
        entityType: "webhookSubscription",
      })
    )
  })

  it("refuses an endpoint from another organization", async () => {
    mocks.findFirst.mockResolvedValueOnce(null)
    await expect(
      updateWebhookSubscription(ctx, { id: "wh_9", active: false })
    ).rejects.toMatchObject({ code: "not_found" })
  })
})

describe("deleteWebhookSubscription", () => {
  it("soft-deletes and deactivates the endpoint", async () => {
    mocks.findFirst.mockResolvedValueOnce(row())
    mocks.update.mockResolvedValue(row({ active: false }))

    await expect(deleteWebhookSubscription(ctx, "wh_1")).resolves.toEqual({
      id: "wh_1",
    })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "wh_1" },
      data: { deletedAt: expect.any(Date), active: false },
    })
    expect(mocks.recordUserAudit).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: "webhook.subscription.deleted",
      })
    )
  })
})
