import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  recordUserAudit: vi.fn(async () => undefined),
  requireEntitlement: vi.fn(async () => undefined),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiToken: {
      count: mocks.count,
      create: mocks.create,
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}))
vi.mock("@/lib/audit", () => ({
  recordUserAudit: mocks.recordUserAudit,
}))
vi.mock("@/lib/organization/entitlements", () => ({
  requireEntitlement: mocks.requireEntitlement,
}))

import {
  createApiToken,
  listApiTokens,
  MAX_ACTIVE_API_TOKENS,
  revokeApiToken,
} from "./token-service"
import { hashApiToken } from "./tokens"

const ctx = {
  organizationId: "org_1",
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  role: "admin" as const,
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok_1",
    name: "CI deploy",
    prefix: "async_abcdef",
    scopes: ["projects:read"],
    createdAt: new Date("2026-11-09T10:00:00.000Z"),
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.count.mockResolvedValue(0)
  mocks.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) =>
      row({
        name: data.name,
        prefix: data.prefix,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
      })
  )
})

describe("createApiToken", () => {
  it("stores a hash and returns the raw token once", async () => {
    const result = await createApiToken(ctx, {
      name: "CI deploy",
      scopes: ["projects:read", "projects:read", "tasks:read"],
    })

    expect(result.token).toMatch(/^async_[A-Za-z0-9_-]{43}$/)
    expect(result.item).toMatchObject({
      id: "tok_1",
      scopes: ["projects:read", "tasks:read"],
    })
    expect(result.item.prefix).toBe(result.token.slice(0, 12))
    const data = mocks.create.mock.calls[0]![0].data
    expect(data.hashedToken).toBe(hashApiToken(result.token))
    expect(data.hashedToken).not.toBe(result.token)
    expect(data.scopes).toEqual(["projects:read", "tasks:read"])
    expect(data.expiresAt).toBeNull()
    expect(mocks.requireEntitlement).toHaveBeenCalledWith("org_1", "apiAccess")
    expect(mocks.recordUserAudit).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: "api_token.created",
        entityType: "apiToken",
        entityId: "tok_1",
      })
    )
  })

  it("sets an expiry when one is requested", async () => {
    const before = Date.now()
    await createApiToken(ctx, {
      name: "Temporary",
      scopes: ["projects:read"],
      expiresInDays: 30,
    })
    const expiresAt = mocks.create.mock.calls[0]![0].data.expiresAt as Date
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 29 * 24 * 60 * 60 * 1000
    )
  })

  it("rejects unknown scopes before touching the database", async () => {
    await expect(
      createApiToken(ctx, { name: "Bad", scopes: ["projects:admin"] })
    ).rejects.toMatchObject({ code: "validation_error" })
    expect(mocks.requireEntitlement).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("enforces the active-token cap", async () => {
    mocks.count.mockResolvedValue(MAX_ACTIVE_API_TOKENS)
    await expect(
      createApiToken(ctx, { name: "One more", scopes: ["projects:read"] })
    ).rejects.toMatchObject({ code: "conflict" })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})

describe("listApiTokens", () => {
  it("scopes the query and never selects the hash", async () => {
    mocks.findMany.mockResolvedValue([row()])
    const items = await listApiTokens(ctx)

    const call = mocks.findMany.mock.calls[0]![0]
    expect(call.where).toEqual({ organizationId: "org_1" })
    expect(call.take).toBe(100)
    expect(call.select).not.toHaveProperty("hashedToken")
    expect(items[0]).toMatchObject({
      id: "tok_1",
      createdAt: "2026-11-09T10:00:00.000Z",
      lastUsedAt: null,
      revokedAt: null,
    })
  })
})

describe("revokeApiToken", () => {
  it("refuses a token from another organization", async () => {
    mocks.findFirst.mockResolvedValue(null)
    await expect(revokeApiToken(ctx, "tok_9")).rejects.toMatchObject({
      code: "not_found",
    })
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "tok_9", organizationId: "org_1" },
      select: { id: true, name: true, revokedAt: true },
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("revokes immediately and audits once", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "tok_1",
      name: "CI deploy",
      revokedAt: null,
    })
    mocks.update.mockResolvedValue({ id: "tok_1" })
    await expect(revokeApiToken(ctx, "tok_1")).resolves.toEqual({
      id: "tok_1",
    })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "tok_1" },
      data: { revokedAt: expect.any(Date) },
    })
    expect(mocks.recordUserAudit).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: "api_token.revoked",
        entityType: "apiToken",
      })
    )
  })

  it("is idempotent", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "tok_1",
      name: "CI deploy",
      revokedAt: new Date(),
    })
    await expect(revokeApiToken(ctx, "tok_1")).resolves.toEqual({
      id: "tok_1",
    })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.recordUserAudit).not.toHaveBeenCalled()
  })
})
