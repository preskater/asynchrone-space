import type { Member, MemberRole } from "@workspace/organization"

export interface MemberSource {
  userId: string
  role: string
  user: {
    name: string
    email: string
    image: string | null
  }
}

const ROLES: MemberRole[] = ["owner", "admin", "member", "viewer"]

function toMemberRole(role: string | null | undefined): MemberRole {
  return ROLES.includes(role as MemberRole) ? (role as MemberRole) : "member"
}

export function toMemberView(source: MemberSource): Member {
  return {
    id: source.userId,
    name: source.user.name,
    email: source.user.email,
    avatarUrl: source.user.image ?? undefined,
    role: toMemberRole(source.role),
  }
}
