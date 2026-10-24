/**
 * Clients domain types. Records are plain, serializable shapes produced by
 * `ClientsService` and consumed by client components.
 */

export const CLIENT_STATUSES = ["prospect", "active", "inactive"] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const CLIENT_ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const
export type ClientActivityType = (typeof CLIENT_ACTIVITY_TYPES)[number]

export const CLIENT_FIELD_ENTITIES = ["client", "contact", "deal"] as const
export type ClientFieldEntity = (typeof CLIENT_FIELD_ENTITIES)[number]

export const CLIENT_FIELD_TYPES = [
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
export type ClientFieldType = (typeof CLIENT_FIELD_TYPES)[number]

export const DEAL_STATUSES = ["open", "won", "lost"] as const
export type DealStatus = (typeof DEAL_STATUSES)[number]

export const PIPELINE_STAGE_TYPES = ["open", "won", "lost"] as const
export type PipelineStageType = (typeof PIPELINE_STAGE_TYPES)[number]

export const CLIENT_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"] as const
export type ClientCurrency = (typeof CLIENT_CURRENCIES)[number]

/** Custom field value: string, number, boolean, string list or empty. */
export type ClientFieldValue = string | number | boolean | string[] | null

export type ClientFieldValues = Record<string, ClientFieldValue>

export interface ClientsAccessData {
  /** Member and above: create and edit records. */
  canEdit: boolean
  /** Admin and above: pipelines, custom fields, deletion of configuration. */
  canManage: boolean
  /** Member and above: CSV exports and imports. */
  canExport: boolean
  currentUserId: string
}

export interface MemberOptionData {
  id: string
  name: string
  email: string
}

export interface ClientFieldDefinitionData {
  id: string
  entity: ClientFieldEntity
  key: string
  label: string
  type: ClientFieldType
  options: string[]
  isRequired: boolean
  position: number
}

export interface ClientSummaryData {
  id: string
  name: string
  status: ClientStatus
  contactEmail?: string
  industry?: string
  website?: string
  phone?: string
  address?: string
  description?: string
  source?: string
  ownerId?: string
  ownerName?: string
  /** Availability for project time tracking (employee/billing flag). */
  isActive: boolean
  customFields: ClientFieldValues
  archivedAt?: string
  createdAt: string
  updatedAt: string
  /** Derived counters used by the list and detail pages. */
  contactCount: number
  openDealCount: number
  openDealValue: number
  projectCount: number
}

export interface ContactCompanyData {
  clientId: string
  clientName: string
  jobTitle?: string
  isPrimary: boolean
}

export interface ContactData {
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
  customFields: ClientFieldValues
  companies: ContactCompanyData[]
  archivedAt?: string
  createdAt: string
  updatedAt: string
  openDealCount: number
}

export interface DealContactData {
  contactId: string
  name: string
  email?: string
  isPrimary: boolean
}

export interface PipelineStageData {
  id: string
  name: string
  position: number
  type: PipelineStageType
  color?: string
  dealCount: number
  totalValue: number
}

export interface PipelineData {
  id: string
  name: string
  isDefault: boolean
  stages: PipelineStageData[]
}

export interface DealData {
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
  customFields: ClientFieldValues
  archivedAt?: string
  createdAt: string
  updatedAt: string
  contacts: DealContactData[]
}

export interface ClientActivityData {
  id: string
  type: ClientActivityType
  subject?: string
  body: string
  occurredAt: string
  authorId: string
  authorName: string
  clientId?: string
  contactId?: string
  dealId?: string
}

export interface ClientSystemEventData {
  id: string
  action: string
  /** Related entity snapshot values (e.g. the new stage name). */
  details: Record<string, string>
  occurredAt: string
  authorName: string
}

export interface TimelineEntryData {
  id: string
  kind: "activity" | "system"
  occurredAt: string
  activity?: ClientActivityData
  system?: ClientSystemEventData
}

export interface ProjectOptionData {
  id: string
  name: string
  status: string
}

/** Project entry with its current company link, used by the link picker. */
export interface ProjectLinkOptionData {
  id: string
  name: string
  status: string
  clientId: string | null
  clientName: string | null
}

export interface ClientOptionData {
  id: string
  name: string
}

export interface ContactOptionData {
  id: string
  name: string
  email?: string
}

export const CLIENT_DOCUMENT_VISIBILITIES = ["internal", "client"] as const
export type ClientDocumentVisibility =
  (typeof CLIENT_DOCUMENT_VISIBILITIES)[number]

/** A file linked to a client record. */
export interface ClientDocumentData {
  id: string
  fileId: string
  name: string
  kind: string
  mimeType?: string
  sizeBytes?: number
  visibility: ClientDocumentVisibility
  trashed: boolean
  addedById: string
  addedByName?: string
  createdAt: string
}

/** Light file entry used by the "add document" picker. */
export interface FileOptionData {
  id: string
  name: string
  kind: string
  mimeType?: string
  modifiedAt: string
}

export interface ClientsOverviewData {
  todayKey: string
  access: ClientsAccessData
  members: MemberOptionData[]
  fieldDefinitions: ClientFieldDefinitionData[]
  clients: ClientSummaryData[]
  contacts: ContactData[]
  pipelines: PipelineData[]
  deals: DealData[]
  /** Latest activity across all records (desk feed). */
  recentActivities: ClientActivityData[]
}

export interface ClientDetailData {
  access: ClientsAccessData
  members: MemberOptionData[]
  fieldDefinitions: ClientFieldDefinitionData[]
  clients: ClientOptionData[]
  client: ClientSummaryData
  contacts: ContactData[]
  deals: DealData[]
  projects: ProjectOptionData[]
  documents: ClientDocumentData[]
  timeline: TimelineEntryData[]
}

export interface ContactDetailData {
  access: ClientsAccessData
  members: MemberOptionData[]
  fieldDefinitions: ClientFieldDefinitionData[]
  clients: ClientOptionData[]
  contact: ContactData
  deals: DealData[]
  documents: ClientDocumentData[]
  timeline: TimelineEntryData[]
}

export interface DealDetailData {
  access: ClientsAccessData
  members: MemberOptionData[]
  fieldDefinitions: ClientFieldDefinitionData[]
  clients: ClientOptionData[]
  contactOptions: ContactOptionData[]
  pipelines: PipelineData[]
  deal: DealData
  documents: ClientDocumentData[]
  timeline: TimelineEntryData[]
}

export interface ClientsImportRowErrorData {
  row: number
  message: string
}

export interface ClientsImportResultData {
  created: number
  restored: number
  skipped: number
  errors: ClientsImportRowErrorData[]
}

export interface ClientsExportResultData {
  filename: string
  content: string
}
