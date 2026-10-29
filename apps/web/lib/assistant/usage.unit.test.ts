import { Usage } from "@openai/agents"
import { beforeEach, describe, expect, it, vi } from "vitest"

const prisma = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  member: { count: vi.fn() },
  aiUsageEvent: { aggregate: vi.fn(), create: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

import { monthWindow } from "@workspace/db/plans"

import type { RequestContext } from "@/lib/core/context"

import { getAiQuota, quotaExceeded, recordAiUsage, tokenUsage } from "./usage"

const ctx: RequestContext = {
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  organizationId: "org_1",
  role: "owner",
}

beforeEach(() => vi.clearAllMocks())

describe("monthWindow", () => {
  it("spans the current UTC month", () => {
    const { start, resetAt } = monthWindow(new Date("2026-12-31T23:59:59Z"))
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z")
    expect(resetAt.toISOString()).toBe("2027-01-01T00:00:00.000Z")
  })
})

describe("getAiQuota", () => {
  it("gives Free no budget", async () => {
    prisma.organization.findUnique.mockResolvedValue({ metadata: null })
    prisma.member.count.mockResolvedValue(3)
    prisma.aiUsageEvent.aggregate.mockResolvedValue({
      _sum: { costMicros: null },
    })
    expect(await getAiQuota("org_1")).toMatchObject({
      budgetMicros: 0,
      usedMicros: 0,
    })
  })

  it("scales the budget with workspace seats and sums this month's spend", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      metadata: '{"plan":"team"}',
    })
    prisma.member.count.mockResolvedValue(4)
    prisma.aiUsageEvent.aggregate.mockResolvedValue({
      _sum: { costMicros: 5_000 },
    })
    const now = new Date("2026-10-29T12:00:00Z")
    expect(await getAiQuota("org_1", now)).toEqual({
      budgetMicros: 4 * 13_000_000,
      usedMicros: 5_000,
      resetAt: new Date("2026-11-01T00:00:00Z"),
    })
    expect(prisma.member.count).toHaveBeenCalledWith({
      where: { organizationId: "org_1", clientId: null },
    })
    expect(prisma.aiUsageEvent.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          createdAt: { gte: new Date("2026-10-01T00:00:00Z") },
        },
      })
    )
  })
})

describe("quotaExceeded", () => {
  it("is a 429 carrying the reset date", () => {
    const error = quotaExceeded(new Date("2026-11-01T00:00:00Z"))
    expect(error).toMatchObject({
      code: "quota_exceeded",
      status: 429,
      params: { resetAt: "2026-11-01T00:00:00.000Z" },
    })
  })
})

describe("recording", () => {
  const usage = new Usage({
    requests: 2,
    inputTokens: 3_000,
    outputTokens: 500,
    totalTokens: 3_500,
    inputTokensDetails: [
      { cached_tokens: 1_000 },
      { cached_tokens: 200 },
    ] as never,
  })

  it("sums cached tokens across requests", () => {
    expect(tokenUsage(usage)).toEqual({
      inputTokens: 3_000,
      outputTokens: 500,
      cachedTokens: 1_200,
    })
  })

  it("writes one event with its cost", async () => {
    await recordAiUsage(ctx, "gpt-4o-mini", usage)
    expect(prisma.aiUsageEvent.create).toHaveBeenCalledTimes(1)
    expect(prisma.aiUsageEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        userId: "user_1",
        model: "gpt-4o-mini",
        requests: 2,
        inputTokens: 3_000,
        outputTokens: 500,
        cachedTokens: 1_200,
        // 1800 × 0.15 + 1200 × 0.075 + 500 × 0.6 = 270 + 90 + 300
        costMicros: 660,
      },
    })
  })

  it("skips runs aborted before any model call", async () => {
    await recordAiUsage(ctx, "gpt-4o-mini", new Usage())
    expect(prisma.aiUsageEvent.create).not.toHaveBeenCalled()
  })
})
