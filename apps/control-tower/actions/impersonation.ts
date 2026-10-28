"use server"

import { createHash, randomBytes } from "node:crypto"

import { redirect } from "next/navigation"

import { z } from "zod"

import { prisma } from "@workspace/db"

import { withPlatformAction } from "@/lib/platform/action"
import { recordPlatformEvent } from "@/lib/platform/audit"

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

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, banned: true },
    })
    if (!target) throw new Error("User not found.")
    if (target.banned) throw new Error("Banned accounts cannot be impersonated.")

    const organization =
      (organizationId
        ? await prisma.member.findFirst({
            where: { userId, organizationId },
            select: { organizationId: true },
          })
        : null) ??
      (await prisma.member.findFirst({
        where: { userId, clientId: null },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      }))

    const token = randomBytes(32).toString("hex")
    const tokenHash = createHash("sha256").update(token).digest("hex")

    await prisma.platformHandoff.create({
      data: {
        tokenHash,
        kind: "impersonate",
        actorId: ctx.userId,
        targetUserId: userId,
        organizationId: organization?.organizationId ?? null,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    await recordPlatformEvent(ctx, {
      action: "platform.impersonate.start",
      targetType: "user",
      targetId: userId,
      organizationId: organization?.organizationId ?? null,
    })

    const base = (process.env.PLATFORM_APP_URL as string).replace(/\/$/, "")
    return `${base}/api/platform/handoff?token=${token}`
  })

  redirect(url)
}
