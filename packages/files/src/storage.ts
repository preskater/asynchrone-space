import { prisma } from "@workspace/db"
import { quotaForPlan } from "@workspace/organization"

export async function orgQuotaBytes(organizationId: string): Promise<number> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { storageQuotaBytes: true, metadata: true },
  })
  if (!organization) return quotaForPlan(null)
  if (organization.storageQuotaBytes !== null) {
    return Number(organization.storageQuotaBytes)
  }
  const plan = parsePlan(organization.metadata)
  return quotaForPlan(plan)
}

function parsePlan(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const parsed = JSON.parse(metadata) as { plan?: string }
    return parsed.plan ?? null
  } catch {
    return null
  }
}

export async function orgUsedBytes(organizationId: string): Promise<number> {
  const result = await prisma.fileNode.aggregate({
    where: { organizationId, trashed: false },
    _sum: { sizeBytes: true },
  })
  return result._sum.sizeBytes ?? 0
}
