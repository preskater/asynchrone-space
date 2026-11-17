import type { DelegatedContext } from "@workspace/contracts"

import type { PublicApiContext } from "./auth"

/**
 * The delegated context for a public API call: the member's identity and role
 * authorize the action, while the token is the audit actor.
 */
export function delegatedApiContext(ctx: PublicApiContext): DelegatedContext {
  return {
    userId: ctx.userId,
    userName: ctx.userName,
    userEmail: ctx.userEmail,
    organizationId: ctx.organization.id,
    role: ctx.role,
    roles: ctx.roles,
    impersonatedBy: null,
    portal: null,
    actor: ctx.actor,
  }
}
