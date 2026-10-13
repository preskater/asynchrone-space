import { z } from "zod"

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date.")

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Expected a YYYY-MM month.")

export const workLocationSchema = z.enum(["office", "remote"])

export const setWorkLocationSchema = z.object({
  date: dateKeySchema,
  /** `null` clears the declared status for that day. */
  status: workLocationSchema.nullable(),
  note: z.string().max(300).optional(),
})

export const leaveTypeSchema = z.enum(["vacation", "sick", "personal", "unpaid"])

export const createTimeOffRequestBase = z.object({
  type: leaveTypeSchema.default("vacation"),
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  reason: z.string().max(500).optional(),
})

export const createTimeOffRequestSchema = createTimeOffRequestBase.refine(
  (value) => value.endDate >= value.startDate,
  {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  }
)

export const decideTimeOffRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
})

export const setTimeOffAllowanceSchema = z.object({
  userId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  allowanceDays: z.number().min(0).max(365),
})

export const updateHrSettingsSchema = z.object({
  defaultAllowanceDays: z.number().min(0).max(365),
  weeklyHourTarget: z.number().min(1).max(80),
})

export const logTimeEntrySchema = z.object({
  date: dateKeySchema,
  hours: z.number().min(0.25).max(24),
  note: z.string().max(300).optional(),
})

export type SetWorkLocationInput = z.infer<typeof setWorkLocationSchema>
export type CreateTimeOffRequestInput = z.infer<
  typeof createTimeOffRequestSchema
>
export type DecideTimeOffRequestInput = z.infer<
  typeof decideTimeOffRequestSchema
>
export type SetTimeOffAllowanceInput = z.infer<
  typeof setTimeOffAllowanceSchema
>
export type UpdateHrSettingsInput = z.infer<typeof updateHrSettingsSchema>
export type LogTimeEntryInput = z.infer<typeof logTimeEntrySchema>
