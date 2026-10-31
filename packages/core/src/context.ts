import type { MemberRole } from "@workspace/contracts"

export interface RequestContext {
  userId: string
  userName: string
  userEmail: string
  organizationId: string
  role: MemberRole
}

export type RequestContextInput = Partial<RequestContext> & {
  organizationId?: string | null
  userId?: string | null
}

export function isSystemActor(ctx: RequestContext) {
  return ctx.userId === "system"
}
