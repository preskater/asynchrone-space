"use server"

import { revalidatePath } from "next/cache"

import { z } from "zod"

import { prisma } from "@workspace/db"

import { withPlatformAction } from "@/lib/platform/action"
import { recordPlatformEvent } from "@/lib/platform/audit"
import type { ActionResult } from "@/lib/platform/result"

const planSchema = z.object({
  organizationId: z.string().min(1).max(64),
  plan: z.enum(["free", "team", "enterprise"]),
  quotaBytes: z.number().int().positive().nullable(),
})

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    // `metadata` also stores appearance settings; corrupt JSON is replaced.
    return {}
  }
}

export async function updateOrganizationPlan(
  input: unknown
): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }

  const { organizationId, plan, quotaBytes } = parsed.data

  return withPlatformAction(async (ctx) => {
    if (ctx.role !== "platform_admin") {
      return { ok: false, error: "Only platform admins can change plans." }
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { metadata: true, storageQuotaBytes: true },
    })
    if (!organization) return { ok: false, error: "Organization not found." }

    const metadata = parseMetadata(organization.metadata)
    metadata.plan = plan

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        metadata: JSON.stringify(metadata),
        storageQuotaBytes: quotaBytes === null ? null : BigInt(quotaBytes),
      },
    })

    await recordPlatformEvent(ctx, {
      action: "organization.plan.update",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
      before: {
        plan: parseMetadata(organization.metadata).plan ?? "free",
        storageQuotaBytes:
          organization.storageQuotaBytes === null
            ? null
            : organization.storageQuotaBytes.toString(),
      },
      after: { plan, storageQuotaBytes: quotaBytes },
    })

    revalidatePath(`/organizations/${organizationId}`)
    revalidatePath("/organizations")
    return { ok: true }
  })
}

const oauthClientSchema = z.object({
  clientId: z.string().min(1).max(200),
  disabled: z.boolean(),
})

export async function setOAuthClientDisabled(
  input: unknown
): Promise<ActionResult> {
  const parsed = oauthClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }

  const { clientId, disabled } = parsed.data

  return withPlatformAction(async (ctx) => {
    if (ctx.role !== "platform_admin") {
      return { ok: false, error: "Only platform admins can manage OAuth clients." }
    }

    const client = await prisma.oauthClient.findUnique({
      where: { clientId },
      select: { disabled: true, name: true },
    })
    if (!client) return { ok: false, error: "OAuth client not found." }

    await prisma.oauthClient.update({
      where: { clientId },
      data: { disabled },
    })

    await recordPlatformEvent(ctx, {
      action: disabled ? "oauth-client.disable" : "oauth-client.enable",
      targetType: "oauth_client",
      targetId: clientId,
      before: { disabled: client.disabled, name: client.name },
      after: { disabled },
    })

    revalidatePath("/organizations")
    revalidatePath("/users")
    return { ok: true }
  })
}
