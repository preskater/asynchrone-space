import { parseRoles } from "./utils"

/**
 * Pure organization permissions derived from the member role. This mirrors the
 * Better Auth access-control statements without a client fetch, so feature apps
 * can render permission-gated UI from the role resolved on the server.
 */
export function orgPermissions(role: string | null | undefined) {
  const roles = parseRoles(role)
  const isOwner = roles.includes("owner")
  const isAdmin = isOwner || roles.includes("admin")

  return {
    role: role ?? null,
    roles,
    isOwner,
    canUpdateOrganization: isAdmin,
    canDeleteOrganization: isOwner,
    canCreateMember: isAdmin,
    canUpdateMember: isAdmin,
    canDeleteMember: isAdmin,
    canInviteMember: isAdmin,
    canCancelInvitation: isAdmin,
  }
}
