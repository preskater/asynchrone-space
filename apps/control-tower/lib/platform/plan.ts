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

export function parsePlan(metadata: string | null): OrgPlan {
  if (!metadata) return "free"
  try {
    const parsed = JSON.parse(metadata) as { plan?: string }
    if (parsed.plan === "team" || parsed.plan === "enterprise") return parsed.plan
  } catch {
    // Organization metadata also holds appearance settings; ignore bad JSON.
  }
  return "free"
}

export function orgQuotaBytes(organization: {
  storageQuotaBytes: bigint | null
  metadata: string | null
}): number {
  if (organization.storageQuotaBytes !== null) {
    return Number(organization.storageQuotaBytes)
  }
  return PLAN_QUOTA_BYTES[parsePlan(organization.metadata)]
}

export function usagePercent(used: number, quota: number): number {
  if (quota <= 0) return 0
  return Math.min(100, Math.round((used / quota) * 100))
}
