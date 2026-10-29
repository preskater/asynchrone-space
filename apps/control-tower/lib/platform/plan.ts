export type OrgPlan = "free" | "team" | "enterprise"

const GB = 1024 * 1024 * 1024

/**
 * Kept in sync with `apps/web/lib/organization/plans.ts`. The control tower
 * reads quotas but must not depend on the customer app's runtime code.
 */
export const PLAN_QUOTA_BYTES: Record<OrgPlan, number> = {
  free: 1 * GB,
  team: 100 * GB,
  enterprise: 1024 * GB,
}

/** Legacy plans live in `metadata.plan`; billing moved them to `subscription`. */
export function parsePlan(metadata: string | null): OrgPlan {
  if (!metadata) return "free"
  try {
    const parsed = JSON.parse(metadata) as { plan?: string }
    if (parsed.plan === "team" || parsed.plan === "enterprise")
      return parsed.plan
  } catch {
    // Organization metadata also holds appearance settings; ignore bad JSON.
  }
  return "free"
}

export interface PlanSource {
  metadata: string | null
  storageQuotaBytes: bigint | null
  subscription: { plan: string } | null
}

/** The subscription row is authoritative; metadata is the legacy fallback. */
export function effectivePlan(organization: {
  metadata: string | null
  subscription: { plan: string } | null
}): OrgPlan {
  const plan = organization.subscription?.plan
  if (plan === "team" || plan === "enterprise" || plan === "free") return plan
  return parsePlan(organization.metadata)
}

export function orgQuotaBytes(organization: PlanSource): number {
  if (organization.storageQuotaBytes !== null) {
    return Number(organization.storageQuotaBytes)
  }
  return PLAN_QUOTA_BYTES[effectivePlan(organization)]
}

export function usagePercent(used: number, quota: number): number {
  if (quota <= 0) return 0
  return Math.min(100, Math.round((used / quota) * 100))
}
