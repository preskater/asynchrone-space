import type { MemberRole } from "@workspace/contracts"

/** The actor recorded in the audit trail when it is not the member itself. */
export interface RequestActor {
  id: string
  name?: string | null
  email?: string | null
}

export interface RequestContext {
  userId: string
  userName: string
  userEmail: string
  organizationId: string
  role: MemberRole
  /**
   * Set when an API token performs the action on the user's behalf. Audit
   * writers prefer it so the token, not the member, is the actor.
   */
  actor?: RequestActor
}

/** Audit columns for `ctx`, preferring an API-token actor when present. */
export function auditActorFields(
  ctx: Pick<RequestContext, "userId" | "actor">
): {
  actorId: string
  actorName?: string | null
  actorEmail?: string | null
} {
  return {
    actorId: ctx.actor?.id ?? ctx.userId,
    actorName: ctx.actor?.name ?? undefined,
    actorEmail: ctx.actor?.email ?? undefined,
  }
}

export type RequestContextInput = Partial<RequestContext> & {
  organizationId?: string | null
  userId?: string | null
}

export function isSystemActor(ctx: RequestContext) {
  return ctx.userId === "system"
}
