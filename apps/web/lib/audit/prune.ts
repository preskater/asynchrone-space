import type { PrismaClient } from "@workspace/db"

import { prisma } from "@/lib/prisma"

import { auditRetentionCutoff, resolveAuditRetention } from "./retention"

/** Organizations read per page while walking the table. */
const ORG_PAGE_SIZE = 100
/**
 * Rows deleted per statement. Bounded so one organization with a huge backlog
 * never holds a long lock during a scheduled run.
 */
const DELETE_BATCH_SIZE = 5_000
/** Next run continues where this one stopped, so a backlog never blocks. */
const MAX_BATCHES_PER_ORGANIZATION = 20

export type PruneDb = Pick<PrismaClient, "organization" | "auditLog">

interface PruneOrganization {
  id: string
  metadata: string | null
  trialEndsAt: Date | null
  subscription: { plan: string } | null
}

export interface AuditPruneResult {
  organizations: number
  deleted: number
  /** Organizations that still hold expired rows after the batch cap. */
  capped: number
}

export interface AuditPruneOptions {
  now?: Date
  db?: PruneDb
  maxBatchesPerOrganization?: number
  batchSize?: number
}

/**
 * Drops audit rows older than each organization's plan retention window.
 *
 * Only `AuditLog` is touched: the control tower's `PlatformAuditEvent` is a
 * separate table with its own lifecycle and must outlive the customer-visible
 * trail. Idempotent: a second run the same day deletes nothing.
 */
export async function pruneAuditLogs(
  options: AuditPruneOptions = {}
): Promise<AuditPruneResult> {
  const now = options.now ?? new Date()
  const db = options.db ?? prisma
  const batchSize = options.batchSize ?? DELETE_BATCH_SIZE
  const maxBatches =
    options.maxBatchesPerOrganization ?? MAX_BATCHES_PER_ORGANIZATION

  const result: AuditPruneResult = {
    organizations: 0,
    deleted: 0,
    capped: 0,
  }

  let cursorId: string | null = null
  for (;;) {
    const organizations: PruneOrganization[] = await db.organization.findMany({
      select: {
        id: true,
        metadata: true,
        trialEndsAt: true,
        subscription: { select: { plan: true } },
      },
      orderBy: { id: "asc" },
      take: ORG_PAGE_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    })
    if (organizations.length === 0) break
    cursorId = organizations[organizations.length - 1]?.id ?? null

    for (const organization of organizations) {
      result.organizations += 1
      const retention = resolveAuditRetention(
        {
          metadata: organization.metadata,
          trialEndsAt: organization.trialEndsAt,
          subscription: organization.subscription ?? null,
        },
        now
      )
      const cutoff = auditRetentionCutoff(retention.days, now)

      let mayHaveMore = false
      for (let batch = 0; batch < maxBatches; batch += 1) {
        const stale = await db.auditLog.findMany({
          where: { organizationId: organization.id, createdAt: { lt: cutoff } },
          select: { id: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: batchSize,
        })
        if (stale.length === 0) {
          mayHaveMore = false
          break
        }
        const { count } = await db.auditLog.deleteMany({
          where: { id: { in: stale.map((row) => row.id) } },
        })
        result.deleted += count
        if (stale.length < batchSize) {
          mayHaveMore = false
          break
        }
        mayHaveMore = true
      }
      if (mayHaveMore) {
        const left = await db.auditLog.count({
          where: { organizationId: organization.id, createdAt: { lt: cutoff } },
        })
        if (left > 0) result.capped += 1
      }
    }

    if (organizations.length < ORG_PAGE_SIZE) break
  }

  return result
}
