import { createHash, randomBytes } from "node:crypto"

import {
  type AdminBanInput,
  type AdminHandoffInput,
  type AdminHandoffResult,
  type AdminOrganization,
  type AdminOrganizationPage,
  type AdminPlanInput,
  type AdminSessionRevokeResult,
  type AdminTrialInput,
  type AdminUser,
  type AdminUserPage,
} from "@workspace/contracts"
import { planForOrganization } from "@workspace/audit"
import { prisma } from "@workspace/db-identity"

const DAY = 24 * 60 * 60 * 1000
const PAGE_SIZE = 50

export interface AdminRepository {
  listOrganizations(input: {
    query?: string
    cursor?: string | null
    limit?: number
  }): Promise<AdminOrganizationPage>
  getOrganization(id: string): Promise<AdminOrganization | null>
  updatePlan(
    id: string,
    input: AdminPlanInput
  ): Promise<AdminOrganization | null>
  releasePlan(id: string): Promise<AdminOrganization | null>
  setTrial(
    id: string,
    input: AdminTrialInput
  ): Promise<AdminOrganization | null>
  listUsers(input: {
    query?: string
    cursor?: string | null
    limit?: number
  }): Promise<AdminUserPage>
  getUser(id: string): Promise<AdminUser | null>
  setBan(id: string, input: AdminBanInput): Promise<AdminUser | null>
  revokeSessions(id: string): Promise<AdminSessionRevokeResult>
  createHandoff(input: AdminHandoffInput): Promise<AdminHandoffResult>
}

type OrgRow = {
  id: string
  name: string
  slug: string
  metadata: string | null
  createdAt: Date
  trialEndsAt: Date | null
  deletionScheduledAt: Date | null
  storageQuotaBytes: bigint | null
  subscription: {
    plan: string
    status: string
    manualOverride: boolean
  } | null
  _count: { members: number }
}

function organization(row: OrgRow): AdminOrganization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: planForOrganization({
      metadata: row.metadata,
      subscription: row.subscription,
    }),
    subscriptionStatus: row.subscription?.status ?? null,
    manualOverride: row.subscription?.manualOverride ?? false,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    deletionScheduledAt: row.deletionScheduledAt?.toISOString() ?? null,
    memberCount: row._count.members,
    storageQuotaBytes: row.storageQuotaBytes?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function user(row: {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean | null
  banReason: string | null
  twoFactorEnabled: boolean | null
  createdAt: Date
}): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    banned: row.banned ?? false,
    banReason: row.banReason,
    twoFactorEnabled: row.twoFactorEnabled ?? false,
    createdAt: row.createdAt.toISOString(),
  }
}

const ORG_SELECT = {
  id: true,
  name: true,
  slug: true,
  metadata: true,
  createdAt: true,
  trialEndsAt: true,
  deletionScheduledAt: true,
  storageQuotaBytes: true,
  subscription: { select: { plan: true, status: true, manualOverride: true } },
  _count: { select: { members: true } },
} as const

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  banned: true,
  banReason: true,
  twoFactorEnabled: true,
  createdAt: true,
} as const

function limitOf(value: number | undefined): number {
  return value && value > 0 ? Math.min(Math.floor(value), 100) : PAGE_SIZE
}

function metadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export const adminRepository: AdminRepository = {
  async listOrganizations({ query, cursor, limit }) {
    const take = limitOf(limit)
    const where = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}
    const rows = await prisma.organization.findMany({
      where,
      select: ORG_SELECT,
      orderBy: { id: "asc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > take
    const items = hasMore ? rows.slice(0, take) : rows
    return {
      items: items.map(organization),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      total: await prisma.organization.count({ where }),
    }
  },

  async getOrganization(id) {
    const row = await prisma.organization.findUnique({
      where: { id },
      select: ORG_SELECT,
    })
    return row ? organization(row) : null
  },

  async updatePlan(id, input) {
    const row = await prisma.organization.findUnique({
      where: { id },
      select: {
        metadata: true,
        storageQuotaBytes: true,
        subscription: { select: { plan: true } },
      },
    })
    if (!row) return null
    const next = metadata(row.metadata)
    next.plan = input.plan
    const status = input.plan === "free" ? "inactive" : "active"
    await prisma.$transaction([
      prisma.organization.update({
        where: { id },
        data: {
          metadata: JSON.stringify(next),
          storageQuotaBytes:
            input.quotaBytes === null ? null : BigInt(input.quotaBytes),
        },
      }),
      prisma.subscription.upsert({
        where: { organizationId: id },
        create: {
          organizationId: id,
          plan: input.plan,
          status,
          provider: "manual",
          manualOverride: true,
        },
        update: {
          plan: input.plan,
          status,
          provider: "manual",
          manualOverride: true,
          cancelAtPeriodEnd: false,
        },
      }),
    ])
    return this.getOrganization(id)
  },

  async releasePlan(id) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: id },
      select: { providerSubscriptionId: true, manualOverride: true },
    })
    if (!subscription?.manualOverride) return this.getOrganization(id)
    await prisma.subscription.update({
      where: { organizationId: id },
      data: {
        manualOverride: false,
        provider: subscription.providerSubscriptionId ? "stripe" : "manual",
      },
    })
    return this.getOrganization(id)
  },

  async setTrial(id, input) {
    const now = new Date()
    await prisma.organization.update({
      where: { id },
      data: input.end
        ? { trialEndsAt: now, trialEndedAt: now }
        : {
            trialStartedAt: now,
            trialEndsAt: new Date(now.getTime() + input.days * DAY),
            trialEndedAt: null,
            trialReminderSentAt: null,
          },
    })
    return this.getOrganization(id)
  },

  async listUsers({ query, cursor, limit }) {
    const take = limitOf(limit)
    const where = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}
    const rows = await prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { id: "asc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > take
    const items = hasMore ? rows.slice(0, take) : rows
    return {
      items: items.map(user),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      total: await prisma.user.count({ where }),
    }
  },

  async getUser(id) {
    const row = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    })
    return row ? user(row) : null
  },

  async setBan(id, input) {
    const row = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    })
    if (!row) return null
    const banReason = input.banned
      ? input.reason?.trim() || "Banned from the control tower"
      : null
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          banned: input.banned,
          banReason,
          banExpires: null,
        },
      })
      if (input.banned) {
        await tx.session.deleteMany({ where: { userId: id } })
      }
    })
    return this.getUser(id)
  },

  async revokeSessions(id) {
    const result = await prisma.session.deleteMany({ where: { userId: id } })
    return { deleted: result.count }
  },

  async createHandoff(input) {
    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, banned: true },
    })
    if (!target) throw new Error("User not found")
    if (target.banned) throw new Error("Banned accounts cannot be impersonated")

    const organization =
      (input.organizationId
        ? await prisma.member.findFirst({
            where: { userId: target.id, organizationId: input.organizationId },
            select: { organizationId: true },
          })
        : null) ??
      (await prisma.member.findFirst({
        where: { userId: target.id, clientId: null },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      }))

    const token = randomBytes(32).toString("hex")
    await prisma.platformHandoff.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        kind: "impersonate",
        actorId: input.actorId ?? "control-tower",
        targetUserId: target.id,
        organizationId: organization?.organizationId ?? null,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    const base = (process.env.PLATFORM_APP_URL ?? "").replace(/\/$/, "")
    if (!base) throw new Error("PLATFORM_APP_URL is required")
    return { url: `${base}/api/platform/handoff?token=${token}` }
  },
}
