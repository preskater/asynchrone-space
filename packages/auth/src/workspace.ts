import { prisma } from "@workspace/db"

/** Impersonation sessions are capped independently of the normal session. */
export const IMPERSONATION_TTL_SECONDS = 60 * 60
export const IMPERSONATION_TTL_MS = IMPERSONATION_TTL_SECONDS * 1000

/** True when the user is a client-portal member of the organization. */
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
