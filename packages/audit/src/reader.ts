import type { AuditDb, AuditGroupRow, AuditRow, AuditWhereInput } from "./db"
import {
  AUDIT_EXPORT_LIMIT,
  AUDIT_PAGE_SIZE,
  auditWhere,
  type AuditFilter,
  type AuditPageInput,
  type AuditWhere,
} from "./filters"
import { SYSTEM_ACTOR_ID } from "./actions"
import type {
  AuditActorOption,
  AuditEntryView,
  AuditFacetOption,
  AuditFacets,
  AuditPage,
} from "./types"

const AUDIT_ROW_SELECT: Record<string, boolean> = {
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
}

interface ActorIdentity {
  name: string | null
  email: string | null
}

export interface AuditReaderOptions {
  /**
   * Resolve names for rows written before `actorName` was snapshotted. Domain
   * apps usually omit it because they have no user table; Copilot passes an
   * identity-database lookup.
   */
  actorLookup?: (ids: string[]) => Promise<Map<string, ActorIdentity>>
}

function pageSize(limit: number | null | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return AUDIT_PAGE_SIZE
  return Math.min(Math.floor(limit), 100)
}

export function encodeAuditCursor(row: {
  createdAt: Date | string
  id: string
}): string {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt
  return Buffer.from(JSON.stringify([createdAt, row.id]), "utf8").toString(
    "base64url"
  )
}

export function decodeAuditCursor(
  cursor: string | null | undefined
): { createdAt: Date; id: string } | null {
  if (!cursor) return null
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    )
    if (
      !Array.isArray(parsed) ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string"
    ) {
      return null
    }
    const createdAt = new Date(parsed[0])
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id: parsed[1] }
  } catch {
    return null
  }
}

function cursorWhere(
  where: AuditWhere,
  cursor: { createdAt: Date; id: string }
): AuditWhereInput {
  return {
    AND: [
      where,
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ],
  }
}

/**
 * Read/export/prune operations for one app's audit table.
 *
 * Authorization is deliberately not part of the reader: the caller must have
 * checked the workspace role and entitlement (Copilot) or the service token
 * scope (the internal endpoint).
 */
export class AuditReader {
  constructor(
    private readonly db: AuditDb,
    private readonly options: AuditReaderOptions = {}
  ) {}

  private async actorIdentities(
    rows: AuditRow[]
  ): Promise<Map<string, ActorIdentity>> {
    if (!this.options.actorLookup) return new Map()
    const missing = [
      ...new Set(
        rows
          .filter((row) => !row.actorName && row.actorId !== SYSTEM_ACTOR_ID)
          .map((row) => row.actorId)
      ),
    ]
    if (missing.length === 0) return new Map()
    return this.options.actorLookup(missing)
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

  private async views(rows: AuditRow[]): Promise<AuditEntryView[]> {
    const identities = await this.actorIdentities(rows)
    return rows.map((row) => this.toView(row, identities))
  }

  async list(
    organizationId: string,
    input: AuditPageInput
  ): Promise<AuditPage> {
    const limit = pageSize(input.limit)
    const where = auditWhere(organizationId, input)
    const cursor = decodeAuditCursor(input.cursor)

    const rows = await this.db.auditLog.findMany({
      where: cursor ? cursorWhere(where, cursor) : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: AUDIT_ROW_SELECT,
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const last = items[items.length - 1]
    const [total, views] = await Promise.all([
      this.db.auditLog.count({ where }),
      this.views(items),
    ])

    return {
      items: views,
      nextCursor: hasMore && last ? encodeAuditCursor(last) : null,
      total,
    }
  }

  /** Distinct values of the filter dropdowns, within the retention window. */
  async facets(organizationId: string, since?: Date): Promise<AuditFacets> {
    const where: AuditWhere = { organizationId }
    if (since) where.createdAt = { gte: since }

    const [actions, entityTypes, actors] = (await Promise.all([
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
    ])) as [AuditGroupRow[], AuditGroupRow[], AuditGroupRow[]]

    return {
      actions: actions
        .filter((row): row is AuditGroupRow & { action: string } =>
          Boolean(row.action)
        )
        .map((row) => ({ value: row.action, count: row._count._all })),
      entityTypes: entityTypes
        .filter((row): row is AuditGroupRow & { entityType: string } =>
          Boolean(row.entityType)
        )
        .map((row) => ({ value: row.entityType, count: row._count._all })),
      actors: uniqueActors(actors),
    }
  }

  /**
   * Export rows in ascending order, capped at {@link AUDIT_EXPORT_LIMIT}. The
   * caller formats them; Copilot merges parts from every app first.
   */
  async export(
    organizationId: string,
    filter: AuditFilter,
    limit = AUDIT_EXPORT_LIMIT
  ): Promise<{ entries: AuditEntryView[]; truncated: boolean }> {
    const rows = await this.db.auditLog.findMany({
      where: auditWhere(organizationId, filter),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: AUDIT_ROW_SELECT,
    })
    const truncated = rows.length > limit
    const kept = truncated ? rows.slice(0, limit) : rows
    return { entries: await this.views(kept), truncated }
  }

  /**
   * Delete one organization's rows older than `cutoff`, in bounded batches so a
   * large backlog never holds a long lock. Idempotent.
   */
  async prune(
    organizationId: string,
    cutoff: Date,
    options: { batchSize?: number; maxBatches?: number } = {}
  ): Promise<{ deleted: number; capped: boolean }> {
    const batchSize = options.batchSize ?? 5_000
    const maxBatches = options.maxBatches ?? 20
    const where: AuditWhere = {
      organizationId,
      createdAt: { lt: cutoff },
    }
    let deleted = 0
    let mayHaveMore = false

    for (let batch = 0; batch < maxBatches; batch += 1) {
      const stale = await this.db.auditLog.findMany({
        where,
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: batchSize,
      })
      if (stale.length === 0) {
        mayHaveMore = false
        break
      }
      const { count } = await this.db.auditLog.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      })
      deleted += count
      if (stale.length < batchSize) {
        mayHaveMore = false
        break
      }
      mayHaveMore = true
    }

    if (mayHaveMore) {
      const left = await this.db.auditLog.count({ where })
      return { deleted, capped: left > 0 }
    }
    return { deleted, capped: false }
  }
}

/** One option per actor, preferring the snapshot that carries a name. */
function uniqueActors(rows: AuditGroupRow[]): AuditActorOption[] {
  const byId = new Map<string, string | null>()
  for (const row of rows) {
    if (!row.actorId || row.actorId === SYSTEM_ACTOR_ID) continue
    const current = byId.get(row.actorId)
    if (current === undefined || (!current && row.actorName)) {
      byId.set(row.actorId, row.actorName ?? null)
    }
  }
  return [...byId].map(([id, name]) => ({ id, name }))
}

export type { AuditFacetOption }
