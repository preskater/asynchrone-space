import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** Resolved identity of a signed-in client-portal user. */
export interface PortalContext {
  userId: string
  userName: string
  userEmail: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  clientId: string
  clientName: string
}

/**
 * Resolve the portal membership of the signed-in user: the member row linked
 * to a client company. When the user belongs to several organizations the
 * active one wins, otherwise the first membership.
 */
export async function getPortalContext(): Promise<PortalContext | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const activeOrganizationId = session.session.activeOrganizationId as
    | string
    | undefined

  const members = await prisma.member.findMany({
    where: { userId: session.user.id, clientId: { not: null } },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      client: { select: { id: true, name: true } },
    },
  })

  const member =
    members.find((entry) => entry.organizationId === activeOrganizationId) ??
    members[0]

  if (!member?.client) return null

  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    organizationId: member.organization.id,
    organizationName: member.organization.name,
    organizationSlug: member.organization.slug,
    clientId: member.client.id,
    clientName: member.client.name,
  }
}

/** Members of the organization linked to a client company (portal users). */
export async function isPortalMember(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId, clientId: { not: null } },
    select: { id: true },
  })
  return member !== null
}
