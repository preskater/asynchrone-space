import { planForOrganization } from "@/lib/billing/plans"
import { prisma } from "@/lib/prisma"
import { quotaForPlan } from "@/lib/organization/plans"

export async function orgQuotaBytes(organizationId: string): Promise<number> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      storageQuotaBytes: true,
      metadata: true,
      subscription: { select: { plan: true } },
    },
  })
  if (!organization) return quotaForPlan(null)
  if (organization.storageQuotaBytes !== null) {
    return Number(organization.storageQuotaBytes)
  }
  return quotaForPlan(planForOrganization(organization))
}

export async function orgUsedBytes(organizationId: string): Promise<number> {
  const result = await prisma.fileNode.aggregate({
    where: { organizationId, trashed: false },
    _sum: { sizeBytes: true },
  })
  return result._sum.sizeBytes ?? 0
}
