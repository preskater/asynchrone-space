"use server"

import { redirect } from "next/navigation"

import { z } from "zod"

import { withPlatformAction } from "@/lib/platform/action"
import { recordPlatformEvent } from "@/lib/platform/audit"
import { identityAdmin } from "@/lib/platform/identity"

const schema = z.object({
  userId: z.string().min(1).max(64),
  organizationId: z.string().min(1).max(64).optional(),
})

/**
 * Creates a single-use handoff and sends the browser to the customer app,
 * where `/api/platform/handoff` consumes it and opens the impersonated
 * session. No cookie is shared between the two origins (ADR 0018).
 */
export async function startImpersonation(input: unknown): Promise<void> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new Error("Invalid impersonation request.")

  const { userId, organizationId } = parsed.data

  const url = await withPlatformAction(async (ctx) => {
    if (ctx.role !== "platform_admin") {
      throw new Error("Only platform admins can impersonate users.")
    }

    const handoff = await identityAdmin().createHandoff({
      userId,
      organizationId,
      actorId: ctx.userId,
    })

    await recordPlatformEvent(ctx, {
      action: "platform.impersonate.start",
      targetType: "user",
      targetId: userId,
      organizationId: organizationId ?? null,
    })

    return handoff.url
  })

  redirect(url)
}
