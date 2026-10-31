import { z } from "zod"

/**
 * Internal audit contracts shared by every app.
 *
 * Every app owns an `AuditLog` table in its own database and exposes the same
 * read/export/prune API. Copilot fans out and merges the results, so an audit
 * row always lives next to the data it describes.
 */

export const AuditEntrySchema = z.object({
  id: z.string().min(1),
  /** ISO timestamp. */
  createdAt: z.string().datetime(),
  actorId: z.string().min(1),
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  entityLabel: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  before: z.unknown(),
  after: z.unknown(),
})
export type AuditEntry = z.infer<typeof AuditEntrySchema>

export const AuditUnavailableAppSchema = z.object({
  app: z.string().min(1),
  code: z.string().min(1),
  message: z.string(),
})
export type AuditUnavailableApp = z.infer<typeof AuditUnavailableAppSchema>

export const AuditPageSchema = z.object({
  items: z.array(AuditEntrySchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  /** True when at least one app could not be queried. */
  partial: z.boolean().optional(),
  unavailableApps: z.array(AuditUnavailableAppSchema).optional(),
})
export type AuditPage = z.infer<typeof AuditPageSchema>

export const AuditFacetOptionSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
})

export const AuditActorOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
})

export const AuditFacetsSchema = z.object({
  actions: z.array(AuditFacetOptionSchema),
  entityTypes: z.array(AuditFacetOptionSchema),
  actors: z.array(AuditActorOptionSchema),
  partial: z.boolean().optional(),
  unavailableApps: z.array(AuditUnavailableAppSchema).optional(),
})
export type AuditFacets = z.infer<typeof AuditFacetsSchema>

export const AuditExportSchema = z.object({
  entries: z.array(AuditEntrySchema),
  /** True when the filter matched more rows than the per-app cap. */
  truncated: z.boolean(),
  partial: z.boolean().optional(),
  unavailableApps: z.array(AuditUnavailableAppSchema).optional(),
})
export type AuditExport = z.infer<typeof AuditExportSchema>

export const AuditPruneTargetSchema = z.object({
  organizationId: z.string().min(1),
  /** Delete rows with `createdAt` strictly before this ISO timestamp. */
  before: z.string().datetime(),
})

export const AuditPruneRequestSchema = z.object({
  organizations: z.array(AuditPruneTargetSchema).min(1).max(1_000),
  batchSize: z.number().int().min(1).max(50_000).optional(),
  maxBatches: z.number().int().min(1).max(1_000).optional(),
})
export type AuditPruneRequest = z.infer<typeof AuditPruneRequestSchema>

export const AuditPruneResultSchema = z.object({
  organizations: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
  /** Organizations that still hold expired rows after the batch cap. */
  capped: z.number().int().nonnegative(),
})
export type AuditPruneResult = z.infer<typeof AuditPruneResultSchema>
