export type OrgPlan = "free" | "team" | "enterprise"

export const DEFAULT_PLAN: OrgPlan = "free"

const GB = 1024 * 1024 * 1024

export const PLAN_QUOTA_BYTES: Record<OrgPlan, number> = {
  free: 1 * GB,
  team: 100 * GB,
  enterprise: 1024 * GB,
}

export function quotaForPlan(plan: string | null | undefined): number {
  if (plan && plan in PLAN_QUOTA_BYTES) {
    return PLAN_QUOTA_BYTES[plan as OrgPlan]
  }
  return PLAN_QUOTA_BYTES[DEFAULT_PLAN]
}
