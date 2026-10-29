/**
 * CRM domain types. Records are plain, serializable shapes produced by
 * `CrmService` and consumed by client components.
 */

export const CRM_CLIENT_STATUSES = ["prospect", "active", "inactive"] as const
export type CrmClientStatus = (typeof CRM_CLIENT_STATUSES)[number]

export const CRM_ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number]

export const CRM_FIELD_ENTITIES = ["client", "contact", "deal"] as const
export type CrmFieldEntity = (typeof CRM_FIELD_ENTITIES)[number]

export const CRM_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "multiselect",
  "boolean",
  "url",
  "email",
  "phone",
] as const
export type CrmFieldType = (typeof CRM_FIELD_TYPES)[number]

export const DEAL_STATUSES = ["open", "won", "lost"] as const
export type DealStatus = (typeof DEAL_STATUSES)[number]

export const PIPELINE_STAGE_TYPES = ["open", "won", "lost"] as const
export type PipelineStageType = (typeof PIPELINE_STAGE_TYPES)[number]

export const CRM_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"] as const
export type CrmCurrency = (typeof CRM_CURRENCIES)[number]

/** Custom field value: string, number, boolean, string list or empty. */
export type CrmFieldValue = string | number | boolean | string[] | null

export type CrmFieldValues = Record<string, CrmFieldValue>

export interface CrmAccessData {
  /** Member and above: create and edit records. */
  canEdit: boolean
  /** Admin and above: pipelines, custom fields, deletion of configuration. */
  canManage: boolean
  /** Member and above: CSV exports and imports. */
  canExport: boolean
  currentUserId: string
}

export interface CrmMemberOptionData {
  id: string
  name: string
  email: string
}

export interface CrmFieldDefinitionData {
  id: string
  entity: CrmFieldEntity
  key: string
  label: string
  type: CrmFieldType
  options: string[]
  isRequired: boolean
  position: number
}

export interface CrmClientData {
  id: string
  name: string
  status: CrmClientStatus
  contactEmail?: string
  industry?: string
  website?: string
  phone?: string
  address?: string
  description?: string
  source?: string
  ownerId?: string
  ownerName?: string
  /** Availability for project time tracking (HR/billing flag). */
  isActive: boolean
  customFields: CrmFieldValues
  archivedAt?: string
  createdAt: string
  updatedAt: string
  /** Derived counters used by the list and detail pages. */
  contactCount: number
  openDealCount: number
  openDealValue: number
  projectCount: number
}

export interface CrmContactCompanyData {
  clientId: string
  clientName: string
  jobTitle?: string
  isPrimary: boolean
}

export interface CrmContactData {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email?: string
  phone?: string
  jobTitle?: string
  notes?: string
  ownerId?: string
  ownerName?: string
  customFields: CrmFieldValues
  companies: CrmContactCompanyData[]
  archivedAt?: string
  createdAt: string
  updatedAt: string
  openDealCount: number
}

export interface CrmDealContactData {
  contactId: string
  name: string
  email?: string
  isPrimary: boolean
}

export interface CrmPipelineStageData {
  id: string
  name: string
  position: number
  type: PipelineStageType
  color?: string
  dealCount: number
  totalValue: number
}

export interface CrmPipelineData {
  id: string
  name: string
  isDefault: boolean
  stages: CrmPipelineStageData[]
}

export interface CrmDealData {
  id: string
  name: string
  clientId?: string
  clientName?: string
  pipelineId?: string
  stageId?: string
  stageName?: string
  stageType?: PipelineStageType
  amount: number
  currency: string
  probability: number
  status: DealStatus
  expectedCloseDate?: string
  actualCloseDate?: string
  lossReason?: string
  source?: string
  description?: string
  ownerId?: string
  ownerName?: string
  position: number
  customFields: CrmFieldValues
  archivedAt?: string
  createdAt: string
  updatedAt: string
  contacts: CrmDealContactData[]
}

export interface CrmActivityData {
  id: string
  type: CrmActivityType
  subject?: string
  body: string
  occurredAt: string
  authorId: string
  authorName: string
  clientId?: string
  contactId?: string
  dealId?: string
}

export interface CrmSystemEventData {
  id: string
  action: string
  /** Related entity snapshot values (e.g. the new stage name). */
  details: Record<string, string>
  occurredAt: string
  authorName: string
}

export interface CrmTimelineEntryData {
  id: string
  kind: "activity" | "system"
  occurredAt: string
  activity?: CrmActivityData
  system?: CrmSystemEventData
}

export interface CrmProjectOptionData {
  id: string
  name: string
  status: string
}

/** Project entry with its current company link, used by the link picker. */
export interface CrmProjectLinkOptionData {
  id: string
  name: string
  status: string
  clientId: string | null
  clientName: string | null
}

export interface CrmClientOptionData {
  id: string
  name: string
}

export interface CrmContactOptionData {
  id: string
  name: string
  email?: string
}

export const CRM_DOCUMENT_VISIBILITIES = ["internal", "client"] as const
export type CrmDocumentVisibility =
  (typeof CRM_DOCUMENT_VISIBILITIES)[number]

/** A file linked to a CRM record. */
export interface CrmDocumentData {
  id: string
  fileId: string
  name: string
  kind: string
  mimeType?: string
  sizeBytes?: number
  visibility: CrmDocumentVisibility
  trashed: boolean
  addedById: string
  addedByName?: string
  createdAt: string
}

/** Light file entry used by the "add document" picker. */
export interface CrmFileOptionData {
  id: string
  name: string
  kind: string
  mimeType?: string
  modifiedAt: string
}

export interface CrmOverviewStats {
  clients: {
    total: number
    active: number
    prospects: number
    openValue: number
  }
  deals: {
    openCount: number
    openValue: number
    weighted: number
    won30: number
  }
}

/** Keyset cursors for the next page of each overview list. */
export interface CrmOverviewPagination {
  clients: string | null
  contacts: string | null
  deals: string | null
  recentActivities: string | null
}

export interface CrmOverviewData {
  todayKey: string
  access: CrmAccessData
  members: CrmMemberOptionData[]
  fieldDefinitions: CrmFieldDefinitionData[]
  /** Light option lists so forms do not depend on the paginated rows. */
  clientOptions: CrmClientOptionData[]
  contactOptions: CrmContactOptionData[]
  clients: CrmClientData[]
  contacts: CrmContactData[]
  pipelines: CrmPipelineData[]
  deals: CrmDealData[]
  pagination: CrmOverviewPagination
  stats: CrmOverviewStats
  /** Latest activity across all records (desk feed). */
  recentActivities: CrmActivityData[]
}

export interface CrmClientDetailData {
  access: CrmAccessData
  members: CrmMemberOptionData[]
  fieldDefinitions: CrmFieldDefinitionData[]
  clients: CrmClientOptionData[]
  client: CrmClientData
  contacts: CrmContactData[]
  deals: CrmDealData[]
  projects: CrmProjectOptionData[]
  documents: CrmDocumentData[]
  timeline: CrmTimelineEntryData[]
}

export interface CrmContactDetailData {
  access: CrmAccessData
  members: CrmMemberOptionData[]
  fieldDefinitions: CrmFieldDefinitionData[]
  clients: CrmClientOptionData[]
  contact: CrmContactData
  deals: CrmDealData[]
  documents: CrmDocumentData[]
  timeline: CrmTimelineEntryData[]
}

export interface CrmDealDetailData {
  access: CrmAccessData
  members: CrmMemberOptionData[]
  fieldDefinitions: CrmFieldDefinitionData[]
  clients: CrmClientOptionData[]
  contactOptions: CrmContactOptionData[]
  pipelines: CrmPipelineData[]
  deal: CrmDealData
  documents: CrmDocumentData[]
  timeline: CrmTimelineEntryData[]
}

export interface CrmImportRowErrorData {
  row: number
  message: string
}

export interface CrmImportResultData {
  created: number
  restored: number
  skipped: number
  errors: CrmImportRowErrorData[]
}

export interface CrmExportResultData {
  filename: string
  content: string
}
