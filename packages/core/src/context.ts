import type { OrgRole } from "@workspace/organization"

export interface RequestContext {
  userId: string
  userName: string
  userEmail: string
  organizationId: string
  role: OrgRole
}

export type RequestContextInput = Partial<RequestContext> & {
  organizationId?: string | null
  userId?: string | null
}

export function isSystemActor(ctx: RequestContext) {
  return ctx.userId === "system"
}

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
