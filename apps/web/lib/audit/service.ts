import type { PrismaClient } from "@workspace/db"

import { parseOrganizationMetadata } from "@/lib/appearance/types"
import { toCsv } from "@/lib/core/csv"
import type { RequestContext } from "@/lib/core/context"
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/core/errors"
import {
  decodeCursor,
  encodeCursor,
  pageSize,
  toPage,
} from "@/lib/core/pagination"
import { requireEntitlement } from "@/lib/organization/entitlements"
import { ROLE_RANK, roleRank } from "@/lib/organization/roles"
import { prisma } from "@/lib/prisma"

import { AUDIT_ACTIONS, SYSTEM_ACTOR_ID } from "./actions"
import { auditChanges, type AuditChange } from "./changes"
import {
  AUDIT_EXPORT_LIMIT,
  AUDIT_PAGE_SIZE,
  auditWhere,
  type AuditFilter,
  type AuditPageInput,
} from "./filters"
import { recordUserAudit } from "./record"
import {
  AUDIT_RETENTION_DAYS,
  AUDIT_RETENTION_MAX_DAYS,
  AUDIT_RETENTION_MIN_DAYS,
  auditRetentionCutoff,
  normalizeRetentionDays,
  resolveAuditRetention,
} from "./retention"
import type {
  AuditEntryView,
  AuditExport,
  AuditExportFormat,
  AuditFacets,
  AuditPage,
  AuditRetentionView,
} from "./types"

const AUDIT_ROW_SELECT = {
  id: true,
  createdAt: true,
  actorId: true,
  actorName: true,
  actorEmail: true,
  action: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
  ipAddress: true,
  userAgent: true,
  before: true,
  after: true,
} as const

type AuditRow = {
  id: string
  createdAt: Date
  actorId: string
  actorName: string | null
  actorEmail: string | null
  action: string
  entityType: string
  entityId: string
  entityLabel: string | null
  ipAddress: string | null
  userAgent: string | null
  before: unknown
  after: unknown
}

/** Values written by rows that predate the `actorName` snapshot. */
type ActorIdentity = { name: string | null; email: string | null }

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Read access to the customer-facing audit trail: owners and admins of a
 * workspace whose plan includes it. Client-portal accounts never reach the
 * workspace, and members/viewers get a 403.
 */
export class AuditService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async planSource(organizationId: string) {
    const organization = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: {
        metadata: true,
        trialEndsAt: true,
        subscription: { select: { plan: true } },
      },
    })
    if (!organization) throw new NotFoundError("Organization")
    return {
      metadata: organization.metadata,
      trialEndsAt: organization.trialEndsAt,
      subscription: organization.subscription ?? null,
    }
  }

  /** Role first, so a member gets `forbidden` rather than an upsell. */
  private async requireRead(ctx: RequestContext): Promise<void> {
    if (roleRank(ctx.role) < ROLE_RANK.admin) {
      throw new ForbiddenError("Only owners and admins can read the audit log.")
    }
    await requireEntitlement(ctx.organizationId, "auditLog")
  }

  private async retentionFor(
    organizationId: string
  ): Promise<AuditRetentionView> {
    const retention = resolveAuditRetention(
      await this.planSource(organizationId)
    )
    return {
      plan: retention.plan,
      days: retention.days,
      planDays: AUDIT_RETENTION_DAYS[retention.plan],
      overrideDays: retention.overrideDays,
      canConfigure: retention.canConfigure,
      minDays: AUDIT_RETENTION_MIN_DAYS,
      maxDays: AUDIT_RETENTION_MAX_DAYS,
    }
  }

  async retention(ctx: RequestContext): Promise<AuditRetentionView> {
    await this.requireRead(ctx)
    return this.retentionFor(ctx.organizationId)
  }

  async list(ctx: RequestContext, input: AuditPageInput): Promise<AuditPage> {
    await this.requireRead(ctx)
    const limit = pageSize(input.limit, AUDIT_PAGE_SIZE)
    const where = auditWhere(ctx.organizationId, input)
    const cursor = decodeCursor(input.cursor)
    const cursorDate = cursor?.[0] ? new Date(cursor[0]) : null

    const rows = await this.db.auditLog.findMany({
      where:
        cursor && cursorDate && !Number.isNaN(cursorDate.getTime()) && cursor[1]
          ? {
              AND: [
                where,
                {
                  OR: [
                    { createdAt: { lt: cursorDate } },
                    { createdAt: cursorDate, id: { lt: cursor[1] } },
                  ],
                },
              ],
            }
          : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: AUDIT_ROW_SELECT,
    })

    const page = toPage(rows, limit, (row) =>
      encodeCursor([row.createdAt.toISOString(), row.id])
    )
    const [total, identities] = await Promise.all([
      this.db.auditLog.count({ where }),
      this.actorIdentities(page.items),
    ])

    return {
      items: page.items.map((row) => this.toView(row, identities)),
      nextCursor: page.nextCursor,
      total,
    }
  }

  /** Distinct values of the filter dropdowns, within the retention window. */
  async facets(ctx: RequestContext): Promise<AuditFacets> {
    await this.requireRead(ctx)
    const retention = resolveAuditRetention(
      await this.planSource(ctx.organizationId)
    )
    const where = {
      organizationId: ctx.organizationId,
      createdAt: { gte: auditRetentionCutoff(retention.days) },
    }

    const [actions, entityTypes, actors] = await Promise.all([
      this.db.auditLog.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        orderBy: { _count: { action: "desc" } },
        take: 40,
      }),
      this.db.auditLog.groupBy({
        by: ["entityType"],
        where,
        _count: { _all: true },
        orderBy: { _count: { entityType: "desc" } },
        take: 40,
      }),
      // `groupBy`, not `distinct`: Prisma applies `distinct` after fetching, so
      // a busy workspace would only see the actors of the newest rows.
      this.db.auditLog.groupBy({
        by: ["actorId", "actorName"],
        where,
        _count: { _all: true },
        orderBy: { _count: { actorId: "desc" } },
        take: 50,
      }),
    ])

    return {
      actions: actions.map((row) => ({
        value: row.action,
        count: row._count._all,
      })),
      entityTypes: entityTypes.map((row) => ({
        value: row.entityType,
        count: row._count._all,
      })),
      actors: uniqueActors(actors),
    }
  }

  /**
   * Export of the active filter. Capped at {@link AUDIT_EXPORT_LIMIT} rows; the
   * response says when it was truncated so the caller can warn the user.
   */
  async export(
    ctx: RequestContext,
    filter: AuditFilter,
    format: AuditExportFormat
  ): Promise<AuditExport> {
    await this.requireRead(ctx)
    const where = auditWhere(ctx.organizationId, filter)
    const rows = await this.db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: AUDIT_EXPORT_LIMIT + 1,
      select: AUDIT_ROW_SELECT,
    })
    const truncated = rows.length > AUDIT_EXPORT_LIMIT
    const kept = truncated ? rows.slice(0, AUDIT_EXPORT_LIMIT) : rows
    const identities = await this.actorIdentities(kept)
    const entries = kept.map((row) => this.toView(row, identities))
    const today = dayKey(new Date())

    if (format === "json") {
      return {
        filename: `asynchrone-space-audit-${today}.json`,
        contentType: "application/json",
        content: JSON.stringify(
          { exportedAt: new Date().toISOString(), truncated, entries },
          null,
          2
        ),
        count: entries.length,
        truncated,
      }
    }

    const csvRows: (string | number | null)[][] = [
      [
        "Timestamp",
        "Actor",
        "Actor email",
        "Action",
        "Target type",
        "Target id",
        "Target",
        "IP address",
        "User agent",
        "Changes",
      ],
    ]
    for (const entry of entries) {
      csvRows.push([
        entry.createdAt,
        entry.actorName ?? entry.actorId,
        entry.actorEmail ?? "",
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.entityLabel ?? "",
        entry.ipAddress ?? "",
        entry.userAgent ?? "",
        auditChanges(entry.before, entry.after)
          .map((change) => describeChange(change, entry))
          .join("; "),
      ])
    }

    return {
      filename: `asynchrone-space-audit-${today}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: toCsv(csvRows),
      count: entries.length,
      truncated,
    }
  }

  /**
   * Sets the Enterprise retention override, in days; `null` clears it and falls
   * back to the plan default. Owners only: this is a compliance setting.
   */
  async setRetention(
    ctx: RequestContext,
    value: unknown
  ): Promise<AuditRetentionView> {
    await this.requireRead(ctx)
    if (roleRank(ctx.role) < ROLE_RANK.owner) {
      throw new ForbiddenError("Only an owner can change the audit retention.")
    }
    const current = await this.retentionFor(ctx.organizationId)
    if (!current.canConfigure) {
      throw new ForbiddenError("Audit retention is fixed on your plan.", {
        code: "upgrade_required",
      })
    }

    const hasValue = value !== null && value !== undefined && value !== ""
    const days = hasValue ? normalizeRetentionDays(value) : null
    if (hasValue && days === null) {
      throw new ValidationError("Retention must be a number of days.")
    }

    const organization = await this.db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { metadata: true },
    })
    if (!organization) throw new NotFoundError("Organization")

    const metadata = parseOrganizationMetadata(organization.metadata)
    if (days === null) {
      delete metadata.auditRetentionDays
    } else {
      metadata.auditRetentionDays = days
    }
    await this.db.organization.update({
      where: { id: ctx.organizationId },
      data: { metadata: JSON.stringify(metadata) },
    })

    await recordUserAudit(
      ctx,
      {
        action: AUDIT_ACTIONS.organizationAuditRetentionUpdated,
        entityType: "organization",
        entityId: ctx.organizationId,
        entityLabel: null,
        before: { retentionDays: current.days },
        after: { retentionDays: days ?? current.planDays },
      },
      this.db
    )

    return this.retentionFor(ctx.organizationId)
  }

  /** Names for rows written before the `actorName` snapshot existed. */
  private async actorIdentities(
    rows: AuditRow[]
  ): Promise<Map<string, ActorIdentity>> {
    const missing = [
      ...new Set(
        rows
          .filter((row) => !row.actorName && row.actorId !== SYSTEM_ACTOR_ID)
          .map((row) => row.actorId)
      ),
    ]
    if (missing.length === 0) return new Map()
    const users = await this.db.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, name: true, email: true },
    })
    return new Map(
      users.map((user) => [user.id, { name: user.name, email: user.email }])
    )
  }

  private toView(
    row: AuditRow,
    identities: Map<string, ActorIdentity>
  ): AuditEntryView {
    const identity = identities.get(row.actorId)
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actorId: row.actorId,
      actorName: row.actorName ?? identity?.name ?? null,
      actorEmail: row.actorEmail ?? identity?.email ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      before: row.before,
      after: row.after,
    }
  }
}

/** One option per actor, preferring the snapshot that carries a name. */
function uniqueActors(
  rows: { actorId: string; actorName: string | null }[]
): { id: string; name: string | null }[] {
  const byId = new Map<string, string | null>()
  for (const row of rows) {
    if (row.actorId === SYSTEM_ACTOR_ID) continue
    const current = byId.get(row.actorId)
    if (current === undefined || (!current && row.actorName)) {
      byId.set(row.actorId, row.actorName)
    }
  }
  return [...byId].map(([id, name]) => ({ id, name }))
}

function describeChange(change: AuditChange, entry: AuditEntryView): string {
  const label = change.field === "value" ? entry.entityType : change.field
  return `${label}: ${change.before ?? "—"} → ${change.after ?? "—"}`
}

export const auditService = new AuditService()
