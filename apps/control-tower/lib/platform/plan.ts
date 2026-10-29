import { entitlementsFor, parsePlan } from "@workspace/db/plans"

export { parsePlan } from "@workspace/db/plans"

export function orgQuotaBytes(organization: {
  storageQuotaBytes: bigint | null
  metadata: string | null
}): number {
  if (organization.storageQuotaBytes !== null) {
    return Number(organization.storageQuotaBytes)
  }
  return entitlementsFor(parsePlan(organization.metadata)).storageBytes
}

export function usagePercent(used: number, quota: number): number {
  if (quota <= 0) return 0
  return Math.min(100, Math.round((used / quota) * 100))
}
