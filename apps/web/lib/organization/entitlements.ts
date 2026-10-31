import {
  entitlementsFor,
  hasEntitlement,
  type Entitlement,
  type Entitlements,
  type OrgPlan,
} from "@workspace/db/plans"
import { effectivePlan } from "@workspace/db/trial"

import { planForOrganization } from "@/lib/billing/plans"
import { ForbiddenError } from "@workspace/core/errors"
import { prisma } from "@/lib/prisma"

export {
  entitlementsFor,
  type Entitlement,
  type Entitlements,
  type OrgPlan,
} from "@workspace/db/plans"

/** The organization fields plan resolution needs. */
export interface PlanSource {
  metadata: string | null
  trialEndsAt: Date | null
  subscription: { plan: string } | null
}

/**
 * The plan actually enforced. A paid subscription (Stripe or a manual
 * Enterprise grant) wins over `metadata.plan`; either way a free organization
 * is upgraded to Team while its trial window is open. Every entitlement —
 * storage, seats, AI budget, permissions — reads through here, so a trial or a
 * subscription cannot grant some limits but not others.
 */
export function resolvePlan(
  organization: PlanSource,
  now = new Date()
): OrgPlan {
  const stored = planForOrganization(organization)
  return effectivePlan(stored, { trialEndsAt: organization.trialEndsAt }, now)
}

export async function getOrganizationPlan(
  organizationId: string
): Promise<OrgPlan> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      metadata: true,
      trialEndsAt: true,
      subscription: { select: { plan: true } },
    },
  })
  if (!organization) return "free"
  return resolvePlan({
    metadata: organization.metadata,
    trialEndsAt: organization.trialEndsAt,
    subscription: organization.subscription ?? null,
  })
}

export async function getOrganizationEntitlements(
  organizationId: string
): Promise<Entitlements> {
  return entitlementsFor(await getOrganizationPlan(organizationId))
}

export async function can(
  organizationId: string,
  entitlement: Entitlement
): Promise<boolean> {
  return hasEntitlement(
    await getOrganizationEntitlements(organizationId),
    entitlement
  )
}

export function upgradeRequired(entitlement: Entitlement) {
  return new ForbiddenError("This feature requires a higher plan.", {
    code: "upgrade_required",
    params: { entitlement },
  })
}

/** Server-side gate: throws a typed `upgrade_required` error when the plan lacks it. */
export async function requireEntitlement(
  organizationId: string,
  entitlement: Entitlement
): Promise<void> {
  if (!(await can(organizationId, entitlement))) {
    throw upgradeRequired(entitlement)
  }
}

/** Pending invitations hold a seat so an org cannot over-invite past its plan. */
export function seatLimitReached(
  seats: number,
  members: number,
  pendingInvitations: number
): boolean {
  return members + pendingInvitations >= seats
}

/**
 * Whether the organization has used every seat of its plan. Client-portal
 * accounts never take a seat. Pass `countPending` when creating an invitation.
 */
export async function seatsFull(
  organizationId: string,
  { countPending }: { countPending: boolean }
): Promise<{ full: boolean; seats: number }> {
  const { seats } = await getOrganizationEntitlements(organizationId)
  if (seats === Infinity) return { full: false, seats }
  const [members, pending] = await Promise.all([
    prisma.member.count({ where: { organizationId, clientId: null } }),
    countPending
      ? prisma.invitation.count({
          where: {
            organizationId,
            status: "pending",
            expiresAt: { gt: new Date() },
            NOT: { role: "client" },
          },
        })
      : 0,
  ])
  return { full: seatLimitReached(seats, members, pending), seats }
}
