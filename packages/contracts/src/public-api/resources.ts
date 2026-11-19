import { z } from "zod"

import { PublicApiPageQuerySchema } from "./schemas"

/**
 * Public resource shapes. Domain apps map their rows to these schemas before
 * returning them through the delegated API, and the gateway validates the same
 * schemas, so internal fields cannot leak into `/api/v1`.
 */

const isoDate = z.string().datetime()
const nullableIsoDate = isoDate.nullable()
/** CRM close dates are calendar dates (`YYYY-MM-DD`), not timestamps. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
const nullableDateOnly = dateOnly.nullable()

export const PUBLIC_PROJECT_STATUSES = [
  "active",
  "paused",
  "completed",
] as const
export const PUBLIC_TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
] as const
export const PUBLIC_TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const
export const PUBLIC_CLIENT_STATUSES = [
  "prospect",
  "active",
  "inactive",
] as const
export const PUBLIC_DEAL_STATUSES = ["open", "won", "lost"] as const
export const PUBLIC_STAGE_TYPES = ["open", "won", "lost"] as const
export const PUBLIC_FILE_KINDS = [
  "folder",
  "document",
  "spreadsheet",
  "presentation",
  "pdf",
  "image",
  "video",
  "audio",
  "archive",
  "code",
  "other",
] as const

export const PublicLabelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string(),
})
export type PublicLabel = z.infer<typeof PublicLabelSchema>

export const PublicProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(PUBLIC_PROJECT_STATUSES),
  clientId: z.string().min(1).nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  dueDate: nullableIsoDate,
  startDate: nullableIsoDate,
  endDate: nullableIsoDate,
  plannedHours: z.number().nullable(),
  isBillable: z.boolean(),
  memberIds: z.array(z.string().min(1)),
  labelIds: z.array(z.string().min(1)),
  /** The labels behind `labelIds`, so clients can resolve them by name. */
  labels: z.array(PublicLabelSchema),
})
export type PublicProject = z.infer<typeof PublicProjectSchema>

export const PublicTaskSchema = z.object({
  id: z.string().min(1),
  identifier: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(PUBLIC_TASK_STATUSES),
  priority: z.enum(PUBLIC_TASK_PRIORITIES),
  assigneeId: z.string().min(1).nullable(),
  labelIds: z.array(z.string().min(1)),
  dueDate: nullableIsoDate,
  endDate: nullableIsoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type PublicTask = z.infer<typeof PublicTaskSchema>

export const PublicClientSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: z.enum(PUBLIC_CLIENT_STATUSES),
  contactEmail: z.string().email().nullable(),
  industry: z.string().nullable(),
  website: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  description: z.string().nullable(),
  source: z.string().nullable(),
  ownerId: z.string().min(1).nullable(),
  isActive: z.boolean(),
  archivedAt: nullableIsoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type PublicClient = z.infer<typeof PublicClientSchema>

export const PublicContactSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  notes: z.string().nullable(),
  ownerId: z.string().min(1).nullable(),
  companyIds: z.array(z.string().min(1)),
  archivedAt: nullableIsoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type PublicContact = z.infer<typeof PublicContactSchema>

export const PublicDealSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  clientId: z.string().min(1).nullable(),
  pipelineId: z.string().min(1).nullable(),
  stageId: z.string().min(1).nullable(),
  stageName: z.string().nullable(),
  stageType: z.enum(PUBLIC_STAGE_TYPES).nullable(),
  amount: z.number(),
  currency: z.string().min(1),
  probability: z.number().int(),
  status: z.enum(PUBLIC_DEAL_STATUSES),
  expectedCloseDate: nullableDateOnly,
  actualCloseDate: nullableDateOnly,
  lossReason: z.string().nullable(),
  source: z.string().nullable(),
  description: z.string().nullable(),
  ownerId: z.string().min(1).nullable(),
  contactIds: z.array(z.string().min(1)),
  archivedAt: nullableIsoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type PublicDeal = z.infer<typeof PublicDealSchema>

/** The profile half of an employee; the member half comes from the identity DB. */
export const PublicEmployeeProfileSchema = z.object({
  userId: z.string().min(1),
  employmentType: z.string().min(1),
  contractType: z.string().min(1),
  weeklyHours: z.number(),
  managerId: z.string().min(1).nullable(),
  isValidator: z.boolean(),
  isActive: z.boolean(),
})
export type PublicEmployeeProfile = z.infer<typeof PublicEmployeeProfileSchema>

export const PublicEmployeeSchema = PublicEmployeeProfileSchema.extend({
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  orgRole: z.string().min(1),
  createdAt: isoDate,
})
export type PublicEmployee = z.infer<typeof PublicEmployeeSchema>

export const PublicFileSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(PUBLIC_FILE_KINDS),
  parentId: z.string().min(1).nullable(),
  ownerId: z.string().min(1),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  hasStorage: z.boolean(),
  trashed: z.boolean(),
  modifiedAt: isoDate,
})
export type PublicFile = z.infer<typeof PublicFileSchema>

/** `{ items, nextCursor }` as returned by every delegated list operation. */
export function publicPageResultSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  })
}

export const EmployeeProfilesResultSchema = z.object({
  profiles: z.array(PublicEmployeeProfileSchema),
})
export type EmployeeProfilesResult = z.infer<
  typeof EmployeeProfilesResultSchema
>

export const PublicTasksQuerySchema = PublicApiPageQuerySchema.extend({
  projectId: z.string().min(1),
  status: z.enum(PUBLIC_TASK_STATUSES).optional(),
})
export type PublicTasksQuery = z.infer<typeof PublicTasksQuerySchema>

export const PublicFilesQuerySchema = PublicApiPageQuerySchema.extend({
  parentId: z.string().min(1).optional(),
})
export type PublicFilesQuery = z.infer<typeof PublicFilesQuerySchema>
