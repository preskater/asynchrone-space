import { prisma } from "@/lib/prisma"

const SESSION_AUDIT_ACTIONS: Record<string, string> = {
  "/revoke-session": "member.session_revoked",
  "/revoke-other-sessions": "member.other_sessions_revoked",
  "/revoke-sessions": "member.sessions_revoked",
}

/** Audit action for a Better Auth session-revocation endpoint, else null. */
export function sessionAuditAction(path: string | undefined) {
  return (path && SESSION_AUDIT_ACTIONS[path]) || null
}

/** Audit rows are organization-scoped, so the event is logged in each one. */
export async function recordSessionRevocation(
  userId: string,
  path: string | undefined
) {
  const action = sessionAuditAction(path)
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
