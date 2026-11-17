import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  apiTokenFindUnique: vi.fn(),
  apiTokenUpdateMany: vi.fn(async () => ({ count: 0 })),
  memberFindUnique: vi.fn(),
  getOrganizationPlan: vi.fn(),
  entitlementsFor: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiToken: {
      findUnique: mocks.apiTokenFindUnique,
      updateMany: mocks.apiTokenUpdateMany,
    },
    member: { findUnique: mocks.memberFindUnique },
  },
}))
vi.mock("@/lib/organization/entitlements", () => ({
  getOrganizationPlan: mocks.getOrganizationPlan,
  entitlementsFor: mocks.entitlementsFor,
}))
vi.mock("@/lib/core/rate-limit", () => ({ rateLimit: mocks.rateLimit }))

import { authenticatePublicApi } from "./auth"
import { generateApiToken, hashApiToken } from "./tokens"

const raw = generateApiToken()

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok_1",
    organizationId: "org_1",
    name: "CI deploy",
    prefix: "async_abcdef",
    hashedToken: hashApiToken(raw),
    scopes: ["projects:read"],
    createdById: "user_1",
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    organization: { id: "org_1", name: "Acme", slug: "acme" },
    ...overrides,
  }
}

function request(headers: Record<string, string> = {}) {
  return new Request("https://asynchrone.space/api/v1/me", {
    headers: { authorization: `Bearer ${raw}`, ...headers },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.apiTokenFindUnique.mockResolvedValue(tokenRow())
  mocks.memberFindUnique.mockResolvedValue({
    role: "member",
    user: { id: "user_1", name: "Ada", email: "ada@example.com" },
  })
  mocks.getOrganizationPlan.mockResolvedValue("team")
  mocks.entitlementsFor.mockReturnValue({
    apiAccess: true,
    apiRequestsPerMinute: 60,
  })
  mocks.rateLimit.mockResolvedValue({
    allowed: true,
    retryAfter: 0,
    remaining: 59,
    resetAt: 1_800_000_000,
  })
})

describe("authenticatePublicApi", () => {
  it("distinguishes a missing token from an invalid one", async () => {
    await expect(
      authenticatePublicApi(
        new Request("https://asynchrone.space/api/v1/me"),
        "req_1"
      )
    ).rejects.toMatchObject({ code: "missing_token", status: 401 })

    await expect(
      authenticatePublicApi(request({ authorization: "Basic abc" }), "req_1")
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 })

    await expect(
      authenticatePublicApi(request({ authorization: "Bearer nope" }), "req_1")
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 })
  })

  it("rejects an unknown token hash", async () => {
    mocks.apiTokenFindUnique.mockResolvedValueOnce(null)
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 })
  })

  it("rejects revoked and expired tokens with distinct codes", async () => {
    mocks.apiTokenFindUnique.mockResolvedValueOnce(
      tokenRow({ revokedAt: new Date() })
    )
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({ code: "revoked_token", status: 401 })

    mocks.apiTokenFindUnique.mockResolvedValueOnce(
      tokenRow({ expiresAt: new Date(Date.now() - 1000) })
    )
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({ code: "expired_token", status: 401 })
  })

  it("rejects another organization's id or slug", async () => {
    await expect(
      authenticatePublicApi(
        request({ "x-asynchrone-organization": "org_2" }),
        "req_1"
      )
    ).rejects.toMatchObject({ code: "organization_mismatch", status: 403 })
  })

  it("accepts the token's own slug in the organization header", async () => {
    const ctx = await authenticatePublicApi(
      request({ "x-asynchrone-organization": "acme" }),
      "req_1"
    )
    expect(ctx.organization.id).toBe("org_1")
  })

  it("revokes a token whose creator left the organization", async () => {
    mocks.memberFindUnique.mockResolvedValueOnce(null)
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({ code: "revoked_token", status: 401 })
  })

  it("refuses client-portal members", async () => {
    mocks.memberFindUnique.mockResolvedValueOnce({
      role: "client",
      user: { id: "user_1", name: "Ada", email: "ada@example.com" },
    })
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({ code: "forbidden", status: 403 })
  })

  it("requires the plan's API access and a positive limit", async () => {
    mocks.entitlementsFor.mockReturnValueOnce({
      apiAccess: false,
      apiRequestsPerMinute: 60,
    })
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({ code: "upgrade_required", status: 403 })

    mocks.entitlementsFor.mockReturnValueOnce({
      apiAccess: true,
      apiRequestsPerMinute: 0,
    })
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({ code: "upgrade_required", status: 403 })
  })

  it("enforces the route scope", async () => {
    await expect(
      authenticatePublicApi(request(), "req_1", "projects:write")
    ).rejects.toMatchObject({ code: "insufficient_scope", status: 403 })
  })

  it("returns a 429 with Retry-After when the token is over its limit", async () => {
    mocks.rateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 12,
      remaining: 0,
      resetAt: 1_800_000_060,
    })
    await expect(
      authenticatePublicApi(request(), "req_1")
    ).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
      headers: { "Retry-After": "12" },
    })
  })

  it("returns the member, plan, scope and token actor on success", async () => {
    const ctx = await authenticatePublicApi(request(), "req_1", "projects:read")
    expect(ctx).toMatchObject({
      requestId: "req_1",
      userId: "user_1",
      userName: "Ada",
      userEmail: "ada@example.com",
      role: "member",
      plan: "team",
      limits: { requestsPerMinute: 60 },
      rate: { limit: 60, remaining: 59, resetAt: 1_800_000_000 },
      actor: {
        id: "api-token:tok_1",
        name: "CI deploy",
        email: "ada@example.com",
      },
    })
    expect(ctx.me.organization.slug).toBe("acme")
    expect(ctx.me.token.prefix).toBe("async_abcdef")
  })
})
