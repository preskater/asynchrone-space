import { prisma } from "@/lib/prisma"

/**
 * The twoFactor plugin flips the user flag only on these two endpoints: the
 * first verified code enrolls, `disable` removes. Any other user update
 * (profile, sign-in challenge) is not a 2FA change.
 */
export function twoFactorAuditAction(path: string | undefined) {
  if (path === "/two-factor/verify-totp") return "member.two_factor_enabled"
  if (path === "/two-factor/disable") return "member.two_factor_disabled"
  return null
}

/** Audit rows are organization-scoped, so the change is logged in each one. */
export async function recordTwoFactorChange(
  userId: string,
  path: string | undefined
) {
  const action = twoFactorAuditAction(path)
  if (!action) return
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: { organizationId: true },
  })
  if (memberships.length === 0) return
  await prisma.auditLog.createMany({
    data: memberships.map(({ organizationId }) => ({
      organizationId,
      actorId: userId,
      action,
      entityType: "user",
      entityId: userId,
    })),
  })
}
