/** Roles a user can hold inside an organization. */
export type MemberRole = "owner" | "admin" | "member" | "viewer"

/** Member directory entry shared by projects, calendars, files and messages. */
export interface Member {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role: MemberRole
}
