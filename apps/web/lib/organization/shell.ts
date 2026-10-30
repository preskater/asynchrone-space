import {
  entitlementsFor,
  resolvePlan,
  type Entitlements,
} from "@/lib/organization/entitlements"
import { prisma } from "@/lib/prisma"

/** The organization state the authenticated shell needs on every render. */
export interface OrganizationShell {
  /** Enforced plan entitlements (subscription, then `metadata.plan`, then trial). */
  entitlements: Entitlements
  /** Per-organization quota override, or the plan's storage limit. */
  storageQuotaBytes: number
  /** Set while the organization is scheduled for deletion. */
  deletionScheduledAt: Date | null
  /** Stored two-factor policy; the plan decides whether it is enforced. */
  requireTwoFactor: boolean
}

/**
 * One read of the organization row for the app shell, instead of the three
 * separate lookups the layout used to make for the plan, the storage quota and
 * the deletion banner. Returns null when the organization is gone.
 */
export async function getOrganizationShell(
  organizationId: string
): Promise<OrganizationShell | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      metadata: true,
      trialEndsAt: true,
      storageQuotaBytes: true,
      deletionScheduledAt: true,
      requireTwoFactor: true,
      subscription: { select: { plan: true } },
    },
  })
  if (!organization) return null

  const entitlements = entitlementsFor(
    resolvePlan({
      metadata: organization.metadata,
      trialEndsAt: organization.trialEndsAt,
      subscription: organization.subscription ?? null,
    })
  )

  return {
    entitlements,
    // A per-organization override set from the control tower wins over the plan.
    storageQuotaBytes:
      organization.storageQuotaBytes !== null
        ? Number(organization.storageQuotaBytes)
        : entitlements.storageBytes,
    deletionScheduledAt: organization.deletionScheduledAt,
    requireTwoFactor: organization.requireTwoFactor,
  }
}
