"use server"

import { revalidatePath } from "next/cache"

import { z } from "zod"

import { prisma } from "@workspace/db"

import { withPlatformAction } from "@/lib/platform/action"
import { recordPlatformEvent } from "@/lib/platform/audit"
import type { ActionResult } from "@/lib/platform/result"

const banSchema = z.object({
  userId: z.string().min(1).max(64),
  banned: z.boolean(),
  reason: z.string().trim().max(500).optional(),
})

export async function setUserBanned(input: unknown): Promise<ActionResult> {
  const parsed = banSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }

  const { userId, banned, reason } = parsed.data

  return withPlatformAction(async (ctx) => {
    if (ctx.role !== "platform_admin") {
      return { ok: false, error: "Only platform admins can change ban state." }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { banned: true, banReason: true },
    })
    if (!user) return { ok: false, error: "User not found." }

    const banReason = banned
      ? (reason?.trim() || "Banned from the control tower")
      : null

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { banned, banReason, banExpires: null },
      })
      // A banned account must not keep an already-issued session.
      if (banned) {
        await tx.session.deleteMany({ where: { userId } })
      }
    })

    await recordPlatformEvent(ctx, {
      action: banned ? "user.ban" : "user.unban",
      targetType: "user",
      targetId: userId,
      before: { banned: user.banned, banReason: user.banReason },
      after: { banned, banReason },
    })

    revalidatePath(`/users/${userId}`)
    revalidatePath("/users")
    return { ok: true }
  })
}

const sessionsSchema = z.object({ userId: z.string().min(1).max(64) })

/** Support staff may cut off access without waiting for an admin. */
export async function revokeUserSessions(input: unknown): Promise<ActionResult> {
  const parsed = sessionsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }

  const { userId } = parsed.data

  return withPlatformAction(async (ctx) => {
    const result = await prisma.session.deleteMany({ where: { userId } })

    await recordPlatformEvent(ctx, {
      action: "user.sessions.revoke",
      targetType: "user",
      targetId: userId,
      after: { deleted: result.count },
    })

    revalidatePath(`/users/${userId}`)
    return { ok: true }
  })
}
