"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { parseLocalized } from "@/lib/core/validation-server"
import { portalService } from "@/lib/portal"
import {
  cancelPortalInviteSchema,
  claimPortalAccessSchema,
  invitePortalUserSchema,
  revokePortalMemberSchema,
} from "@/lib/portal/schemas"
import { revalidateOrgPath } from "@/lib/organization/paths"

export const invitePortalUserAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(invitePortalUserSchema, input)
  const result = await portalService.invite(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/clients")
  return result
})

export const revokePortalMemberAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(revokePortalMemberSchema, input)
  const result = await portalService.revokeMember(ctx, parsed.memberId)
  await revalidateOrgPath(ctx.organizationId, "/clients")
  return result
})

export const cancelPortalInviteAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(cancelPortalInviteSchema, input)
  const result = await portalService.cancelInvite(ctx, parsed.inviteId)
  await revalidateOrgPath(ctx.organizationId, "/clients")
  return result
})

/**
 * Called from the accept-invitation page right after accepting, to link the
 * new member to the invited company. Works before the active organization is
 * set, so it relies on the invitation id only.
 */
export const claimPortalAccessAction = withAction(async (input: unknown) => {
  const parsed = await parseLocalized(claimPortalAccessSchema, input)
  return portalService.claim(parsed.invitationId)
})
