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
      select: {
        metadata: true,
        storageQuotaBytes: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            provider: true,
            providerSubscriptionId: true,
            manualOverride: true,
          },
        },
      },
    })
    if (!organization) return { ok: false, error: "Organization not found." }

    // `metadata.plan` stays in sync for older readers; `subscription` is what
    // the customer app enforces.
    const metadata = parseMetadata(organization.metadata)
    metadata.plan = plan

    const status = plan === "free" ? "inactive" : "active"

    // A control-tower save is a manual override whatever the plan: webhooks
    // must not put a manually downgraded organization back on its Stripe plan.
    // "Release override" is the only way back to provider-driven state.
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: {
          metadata: JSON.stringify(metadata),
          storageQuotaBytes: quotaBytes === null ? null : BigInt(quotaBytes),
        },
      }),
      prisma.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          plan,
          status,
          provider: "manual",
          manualOverride: true,
        },
        update: {
          plan,
          status,
          provider: "manual",
          manualOverride: true,
          cancelAtPeriodEnd: false,
        },
      }),
    ])

    await recordPlatformEvent(ctx, {
      action: "organization.plan.update",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
      before: {
        plan:
          organization.subscription?.plan ??
          parseMetadata(organization.metadata).plan ??
          "free",
        status: organization.subscription?.status ?? "inactive",
        provider: organization.subscription?.provider ?? "manual",
        manualOverride: organization.subscription?.manualOverride ?? false,
        storageQuotaBytes:
          organization.storageQuotaBytes === null
            ? null
            : organization.storageQuotaBytes.toString(),
      },
      after: {
        plan,
        status,
        provider: "manual",
        manualOverride: true,
        storageQuotaBytes: quotaBytes,
      },
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

const releaseSchema = z.object({
  organizationId: z.string().min(1).max(64),
})

/**
 * Gives the plan back to the payment provider. Keeps the current plan until
 * the next webhook reconciles it, so releasing never silently downgrades a
 * customer mid-period.
 */
export async function releaseOrganizationPlanOverride(
  input: unknown
): Promise<ActionResult> {
  const parsed = releaseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }

  const { organizationId } = parsed.data

  return withPlatformAction(async (ctx) => {
    if (ctx.role !== "platform_admin") {
      return { ok: false, error: "Only platform admins can change plans." }
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        plan: true,
        status: true,
        provider: true,
        manualOverride: true,
        providerSubscriptionId: true,
      },
    })
    if (!subscription)
      return { ok: false, error: "No subscription to release." }
    if (!subscription.manualOverride) {
      return { ok: false, error: "This plan is not manually overridden." }
    }

    const provider = subscription.providerSubscriptionId ? "stripe" : "manual"

    await prisma.subscription.update({
      where: { organizationId },
      data: { manualOverride: false, provider },
    })

    await recordPlatformEvent(ctx, {
      action: "organization.plan.release",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
      before: {
        plan: subscription.plan,
        status: subscription.status,
        provider: subscription.provider,
        manualOverride: true,
      },
      after: {
        plan: subscription.plan,
        status: subscription.status,
        provider,
        manualOverride: false,
      },
    })

    revalidatePath(`/organizations/${organizationId}`)
    revalidatePath("/organizations")
    return { ok: true }
  })
}
