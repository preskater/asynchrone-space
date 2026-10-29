/** Plan catalog and status mapping shared by the billing UI and services. */

import { DEFAULT_PLAN, type OrgPlan } from "@/lib/organization/plans"

import type { BillingInterval, SubscriptionStatus } from "./types"

/** Narrow an unknown string to a known plan, defaulting to Starter. */
export function normalizePlan(value: string | null | undefined): OrgPlan {
  if (value === "team" || value === "enterprise" || value === "free") {
    return value
  }
  return DEFAULT_PLAN
}

/**
 * Organizations created before billing existed carry their plan in
 * `metadata.plan` (written by the control tower). It stays as a fallback so
 * those workspaces keep their quota until a subscription row exists.
 */
export function parsePlanMetadata(metadata: string | null): OrgPlan {
  if (!metadata) return DEFAULT_PLAN
  try {
    const parsed = JSON.parse(metadata) as { plan?: string }
    return normalizePlan(parsed.plan)
  } catch {
    return DEFAULT_PLAN
  }
}

/** Effective plan: the subscription row wins over the legacy metadata field. */
export function planForOrganization(organization: {
  metadata: string | null
  subscription: { plan: string } | null
}): OrgPlan {
  if (organization.subscription) {
    return normalizePlan(organization.subscription.plan)
  }
  return parsePlanMetadata(organization.metadata)
}

export const PAID_PLAN: OrgPlan = "team"

/**
 * Team pricing in the smallest currency unit. Yearly is 10 × months, matching
 * the "€12 monthly / €10 billed yearly" copy on the pricing page.
 */
export const TEAM_PRICE: Record<
  BillingInterval,
  { amount: number; currency: string; label: string }
> = {
  month: { amount: 1200, currency: "eur", label: "€12 / month" },
  year: { amount: 12000, currency: "eur", label: "€120 / year" },
}

const PROVIDER_STATUS_ALIASES: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "inactive",
  incomplete_expired: "canceled",
  paused: "inactive",
}

/** Unknown provider statuses are treated as inactive rather than paid. */
export function normalizeStatus(
  raw: string | null | undefined
): SubscriptionStatus {
  if (!raw) return "inactive"
  return PROVIDER_STATUS_ALIASES[raw] ?? "inactive"
}

/**
 * The plan a status entitles the organization to. `past_due` keeps Team while
 * the provider retries the payment; losing the plan is what would delete the
 * customer's access to their own data.
 */
export function planForStatus(status: SubscriptionStatus): OrgPlan {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
      return PAID_PLAN
    default:
      return DEFAULT_PLAN
  }
}

export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === "team" || plan === "enterprise"
}
