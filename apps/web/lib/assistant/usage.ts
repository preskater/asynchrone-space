import type { Usage } from "@openai/agents"
import { monthWindow } from "@workspace/db/plans"

import { AppError } from "@/lib/core/errors"
import type { RequestContext } from "@/lib/core/context"
import { getOrganizationEntitlements } from "@/lib/organization/entitlements"
import { prisma } from "@/lib/prisma"

import { costMicros, type TokenUsage } from "./pricing"

export async function getAiQuota(organizationId: string, now = new Date()) {
  const { start, resetAt } = monthWindow(now)
  const [{ aiBudgetMicrosPerSeat }, seats, spent] = await Promise.all([
    getOrganizationEntitlements(organizationId),
    // Client-portal accounts never take a seat, so they add no budget either.
    prisma.member.count({ where: { organizationId, clientId: null } }),
    prisma.aiUsageEvent.aggregate({
      where: { organizationId, createdAt: { gte: start } },
      _sum: { costMicros: true },
    }),
  ])
  return {
    budgetMicros: aiBudgetMicrosPerSeat * seats,
    usedMicros: spent._sum.costMicros ?? 0,
    resetAt,
  }
}

export function quotaExceeded(resetAt: Date) {
  return new AppError(
    "quota_exceeded",
    "Your workspace has used its AI allowance for this month.",
    { status: 429, params: { resetAt: resetAt.toISOString() } }
  )
}

/**
 * Provider token details are `{ [key: string]: number | TokenDetails }`, so a
 * count is only read when the value is actually a number.
 */
function detailCount(details: object, key: string): number {
  const value = (details as Record<string, unknown>)[key]
  return typeof value === "number" ? value : 0
}

/** Sums the run's per-request token details into the fields we store. */
export function tokenUsage(usage: Usage): TokenUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedTokens: usage.inputTokensDetails.reduce(
      (sum, details) => sum + detailCount(details, "cached_tokens"),
      0
    ),
  }
}

export async function recordAiUsage(
  ctx: RequestContext,
  model: string,
  usage: Usage
) {
  const tokens = tokenUsage(usage)
  if (usage.requests === 0 && tokens.inputTokens === 0) return
  await prisma.aiUsageEvent.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      model,
      requests: usage.requests,
      ...tokens,
      costMicros: costMicros(model, tokens),
    },
  })
}
