import { entitlementsFor, parsePlan } from "@workspace/db/plans"

import { prisma } from "@/lib/prisma"
import { effectivePlan } from "@/lib/organization/trial"

export async function orgQuotaBytes(organizationId: string): Promise<number> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { storageQuotaBytes: true, metadata: true, trialEndsAt: true },
  })
  // A per-organization override set from the control tower wins over the plan.
  if (organization?.storageQuotaBytes != null) {
    return Number(organization.storageQuotaBytes)
  }
  return entitlementsFor(
    effectivePlan(parsePlan(organization?.metadata), {
      trialEndsAt: organization?.trialEndsAt ?? null,
    })
  ).storageBytes
}

export async function orgUsedBytes(organizationId: string): Promise<number> {
  const result = await prisma.fileNode.aggregate({
    where: { organizationId, trashed: false },
    _sum: { sizeBytes: true },
  })
  return result._sum.sizeBytes ?? 0
}
