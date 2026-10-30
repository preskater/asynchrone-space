import { z } from "zod"

import type { Prisma } from "@workspace/db"

/** Rows per page in the settings table (`lib/core/pagination` clamps too). */
export const AUDIT_PAGE_SIZE = 50

/**
 * Hard cap on one export. Retention already bounds the table, but an
 * Enterprise workspace with a long window can still hold millions of rows; a
 * larger filter is exported truncated and the caller tells the user so.
 */
export const AUDIT_EXPORT_LIMIT = 5_000

const DAY_MS = 24 * 60 * 60 * 1000

const dateKeySchema = z.iso.date("Expected a YYYY-MM-DD date.")

/**
 * Filters accepted by the settings page, the export and the server actions.
 * Empty strings are treated as "no filter" because they come from cleared
 * form controls.
 */
export const auditFilterSchema = z.object({
  actorId: z.string().trim().max(100).optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(60).optional(),
  from: dateKeySchema.or(z.literal("")).optional(),
  to: dateKeySchema.or(z.literal("")).optional(),
})

export type AuditFilter = z.infer<typeof auditFilterSchema>

export const auditPageInputSchema = auditFilterSchema.extend({
  cursor: z.string().max(512).nullish(),
  limit: z.number().int().min(1).max(100).nullish(),
})

export type AuditPageInput = z.infer<typeof auditPageInputSchema>

/** Parses a `YYYY-MM-DD` key as UTC midnight; `null` when it is not a day. */
export function parseDayUtc(value: string | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejects days that spill into the next month (2026-02-30).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

/**
 * Inclusive `createdAt` bounds for the filter. Days are UTC days: `to` covers
 * the whole day, so a single-day range still matches its events.
 */
export function auditDateRange(
  filter: AuditFilter
): { gte?: Date; lt?: Date } | null {
  const from = parseDayUtc(filter.from)
  const to = parseDayUtc(filter.to)
  if (!from && !to) return null
  const range: { gte?: Date; lt?: Date } = {}
  if (from) range.gte = from
  // `lt` on the following midnight keeps the upper bound exclusive without
  // missing events at 23:59:59.999.
  if (to) range.lt = new Date(to.getTime() + DAY_MS)
  return range
}

/** Prisma `where` clause for one organization and a filter. */
export function auditWhere(
  organizationId: string,
  filter: AuditFilter
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = { organizationId }
  if (filter.actorId) where.actorId = filter.actorId
  if (filter.action) where.action = filter.action
  if (filter.entityType) where.entityType = filter.entityType
  const range = auditDateRange(filter)
  if (range) where.createdAt = range
  return where
}
