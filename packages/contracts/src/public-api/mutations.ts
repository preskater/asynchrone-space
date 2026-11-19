import { z } from "zod"

import {
  PUBLIC_CLIENT_STATUSES,
  PUBLIC_PROJECT_STATUSES,
  PUBLIC_TASK_PRIORITIES,
  PUBLIC_TASK_STATUSES,
} from "./resources"

/** Request bodies accepted by the public mutation endpoints. */
const text = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) => text(max).nullable().optional()
const nullableDate = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()])
  .nullable()
const optionalDate = nullableDate.optional()

export const PUBLIC_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"] as const

const REQUIRED_PATCH = {
  message: "At least one field is required.",
} as const

export const PublicCreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: text(2000).optional(),
  status: z.enum(PUBLIC_PROJECT_STATUSES).optional(),
  memberIds: z.array(z.string().min(1)).max(100).optional(),
  labelIds: z.array(z.string().min(1)).max(100).optional(),
})
export type PublicCreateProject = z.infer<typeof PublicCreateProjectSchema>

export const PublicUpdateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: text(2000).nullable().optional(),
    status: z.enum(PUBLIC_PROJECT_STATUSES).optional(),
    memberIds: z.array(z.string().min(1)).max(100).optional(),
    labelIds: z.array(z.string().min(1)).max(100).optional(),
    dueDate: optionalDate,
  })
  .refine((value) => Object.keys(value).length > 0, REQUIRED_PATCH)
  .meta({ minProperties: 1 })
export type PublicUpdateProject = z.infer<typeof PublicUpdateProjectSchema>

export const PublicCreateTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  description: text(5000).optional(),
  status: z.enum(PUBLIC_TASK_STATUSES).optional(),
  priority: z.enum(PUBLIC_TASK_PRIORITIES).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  labelIds: z.array(z.string().min(1)).max(100).optional(),
  dueDate: optionalDate,
  endDate: optionalDate,
})
export type PublicCreateTask = z.infer<typeof PublicCreateTaskSchema>

export const PublicUpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: text(5000).nullable().optional(),
    status: z.enum(PUBLIC_TASK_STATUSES).optional(),
    priority: z.enum(PUBLIC_TASK_PRIORITIES).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    labelIds: z.array(z.string().min(1)).max(100).optional(),
    dueDate: optionalDate,
    endDate: optionalDate,
  })
  .refine((value) => Object.keys(value).length > 0, REQUIRED_PATCH)
  .meta({ minProperties: 1 })
export type PublicUpdateTask = z.infer<typeof PublicUpdateTaskSchema>

export const PublicCreateClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: z.enum(PUBLIC_CLIENT_STATUSES).optional(),
  contactEmail: z.string().trim().email().max(200).nullable().optional(),
  industry: optionalText(120),
  website: optionalText(300),
  phone: optionalText(50),
  address: optionalText(300),
  description: optionalText(2000),
  source: optionalText(120),
  ownerId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
})
export type PublicCreateClient = z.infer<typeof PublicCreateClientSchema>

export const PublicUpdateClientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.enum(PUBLIC_CLIENT_STATUSES).optional(),
    contactEmail: z.string().trim().email().max(200).nullable().optional(),
    industry: optionalText(120),
    website: optionalText(300),
    phone: optionalText(50),
    address: optionalText(300),
    description: optionalText(2000),
    source: optionalText(120),
    ownerId: z.string().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, REQUIRED_PATCH)
  .meta({ minProperties: 1 })
export type PublicUpdateClient = z.infer<typeof PublicUpdateClientSchema>

export const PublicCreateContactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  phone: optionalText(50),
  jobTitle: optionalText(120),
  notes: optionalText(2000),
  ownerId: z.string().min(1).nullable().optional(),
  clientIds: z.array(z.string().min(1)).max(20).optional(),
})
export type PublicCreateContact = z.infer<typeof PublicCreateContactSchema>

export const PublicUpdateContactSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(200).nullable().optional(),
    phone: optionalText(50),
    jobTitle: optionalText(120),
    notes: optionalText(2000),
    ownerId: z.string().min(1).nullable().optional(),
    clientIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, REQUIRED_PATCH)
  .meta({ minProperties: 1 })
export type PublicUpdateContact = z.infer<typeof PublicUpdateContactSchema>

export const PublicCreateDealSchema = z.object({
  name: z.string().trim().min(1).max(160),
  clientId: z.string().min(1).nullable().optional(),
  pipelineId: z.string().min(1).nullable().optional(),
  stageId: z.string().min(1).nullable().optional(),
  amount: z.number().min(0).max(1_000_000_000).optional(),
  currency: z.enum(PUBLIC_CURRENCIES).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.iso.date().nullable().optional(),
  source: optionalText(120),
  description: optionalText(2000),
  ownerId: z.string().min(1).nullable().optional(),
  contactIds: z.array(z.string().min(1)).max(20).optional(),
})
export type PublicCreateDeal = z.infer<typeof PublicCreateDealSchema>

export const PublicUpdateDealSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    clientId: z.string().min(1).nullable().optional(),
    pipelineId: z.string().min(1).nullable().optional(),
    stageId: z.string().min(1).nullable().optional(),
    amount: z.number().min(0).max(1_000_000_000).optional(),
    currency: z.enum(PUBLIC_CURRENCIES).optional(),
    probability: z.number().int().min(0).max(100).optional(),
    expectedCloseDate: z.iso.date().nullable().optional(),
    source: optionalText(120),
    description: optionalText(2000),
    ownerId: z.string().min(1).nullable().optional(),
    contactIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, REQUIRED_PATCH)
  .meta({ minProperties: 1 })
export type PublicUpdateDeal = z.infer<typeof PublicUpdateDealSchema>

export const PublicMoveDealSchema = z.object({
  stageId: z.string().min(1),
  position: z.number().int().min(0).optional(),
  lossReason: optionalText(300),
})
export type PublicMoveDeal = z.infer<typeof PublicMoveDealSchema>
