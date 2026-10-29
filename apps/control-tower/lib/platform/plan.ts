import { entitlementsFor, parsePlan, type OrgPlan } from "@workspace/db/plans"
import {
  effectivePlan,
  isTrialActive,
  trialDaysLeft,
} from "@workspace/db/trial"

export { parsePlan } from "@workspace/db/plans"

type PlanOrganization = {
  metadata: string | null
  trialEndsAt: Date | null
}

/** Organizations whose plan may come from billing carry a subscription row. */
export type BilledOrganization = PlanOrganization & {
  subscription: { plan: string } | null
}

/** The plan stored for the organization, ignoring any running trial. */
export function storedPlan(organization: BilledOrganization): OrgPlan {
  const plan = organization.subscription?.plan
  // Billing writes the enforced plan; `metadata.plan` is the legacy fallback.
  if (plan === "team" || plan === "enterprise" || plan === "free") return plan
  return parsePlan(organization.metadata)
}

/** The plan the customer app enforces: subscription first, then trial. */
export function enforcedPlan(
  organization: BilledOrganization,
  now = new Date()
): OrgPlan {
  return effectivePlan(storedPlan(organization), organization, now)
}

/** Trial state for the detail page: null unless a trial window is open. */
export function trialSummary(
  organization: PlanOrganization,
  now = new Date()
): { daysLeft: number; endsAt: Date } | null {
  if (!organization.trialEndsAt || !isTrialActive(organization, now)) {
    return null
  }
  return {
    daysLeft: trialDaysLeft(organization, now),
    endsAt: organization.trialEndsAt,
  }
}

export function orgQuotaBytes(
  organization: BilledOrganization & {
    storageQuotaBytes: bigint | null
  }
): number {
  // A per-organization override set here wins over the plan.
  if (organization.storageQuotaBytes !== null) {
    return Number(organization.storageQuotaBytes)
  }
  return entitlementsFor(enforcedPlan(organization)).storageBytes
}

export function usagePercent(used: number, quota: number): number {
  if (quota <= 0) return 0
  return Math.min(100, Math.round((used / quota) * 100))
}
