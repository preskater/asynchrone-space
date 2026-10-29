import { entitlementsFor, parsePlan, type OrgPlan } from "@workspace/db/plans"
import { effectivePlan, isTrialActive, trialDaysLeft } from "@workspace/db/trial"

export { parsePlan } from "@workspace/db/plans"

type PlanOrganization = {
  metadata: string | null
  trialEndsAt: Date | null
}

/** The plan the customer app enforces, including an active Team trial. */
export function enforcedPlan(organization: PlanOrganization): OrgPlan {
  return effectivePlan(parsePlan(organization.metadata), organization)
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

export function orgQuotaBytes(organization: {
  storageQuotaBytes: bigint | null
  metadata: string | null
  trialEndsAt: Date | null
}): number {
  if (organization.storageQuotaBytes !== null) {
    return Number(organization.storageQuotaBytes)
  }
  return entitlementsFor(enforcedPlan(organization)).storageBytes
}

export function usagePercent(used: number, quota: number): number {
  if (quota <= 0) return 0
  return Math.min(100, Math.round((used / quota) * 100))
}
