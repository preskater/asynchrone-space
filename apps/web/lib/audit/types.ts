import type { OrgPlan } from "@workspace/db/plans"

/** One audit row as the settings page and the export render it. */
export interface AuditEntryView {
  id: string
  /** ISO timestamp. */
  createdAt: string
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

export interface AuditPage {
  items: AuditEntryView[]
  nextCursor: string | null
  /** Rows matching the active filter, for the "12 480 events" header. */
  total: number
}

export interface AuditFacetOption {
  value: string
  count: number
}

export interface AuditActorOption {
  id: string
  name: string | null
}

export interface AuditFacets {
  actions: AuditFacetOption[]
  entityTypes: AuditFacetOption[]
  actors: AuditActorOption[]
}

export type AuditExportFormat = "csv" | "json"

export interface AuditExport {
  filename: string
  contentType: string
  content: string
  count: number
  /** True when the filter matched more rows than {@link AUDIT_EXPORT_LIMIT}. */
  truncated: boolean
}

export interface AuditRetentionView {
  plan: OrgPlan
  /** Days enforced right now. */
  days: number
  /** The plan default, before any Enterprise override. */
  planDays: number
  overrideDays: number | null
  canConfigure: boolean
  minDays: number
  maxDays: number
}
