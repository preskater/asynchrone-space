"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { parseLocalized } from "@/lib/core/validation-server"
import {
  activitySchema,
  adjustBalanceSchema,
  clearAttendanceSchema,
  clientSchema,
  createLeaveSchema,
  decideLeaveSchema,
  exportSchema,
  fetchRangeSchema,
  hrService,
  projectHrSchema,
  setAllowanceSchema,
  setAttendanceSchema,
  setDayStatusSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from "@/lib/hr"
import { revalidateOrgPath } from "@/lib/organization/paths"

export const fetchAttendanceAction = withAction(
  async (from: string, to: string) => {
    const ctx = await getRequestContext()
    const parsed = fetchRangeSchema.parse({ from, to })
    return hrService.fetchAttendance(ctx, parsed.from, parsed.to)
  }
)

export const fetchTrackingAction = withAction(
  async (from: string, to: string) => {
    const ctx = await getRequestContext()
    const parsed = fetchRangeSchema.parse({ from, to })
    return hrService.fetchTracking(ctx, parsed.from, parsed.to)
  }
)

export const setAttendanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setAttendanceSchema, input)
  const entry = await hrService.setAttendance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return entry
})

export const clearAttendanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(clearAttendanceSchema, input)
  const result = await hrService.clearAttendance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return result
})

export const setDayStatusAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setDayStatusSchema, input)
  const result = await hrService.setDayStatus(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return result
})

export const createLeaveAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(createLeaveSchema, input)
  const request = await hrService.createLeave(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return request
})

export const decideLeaveAction = withAction(
  async (requestId: string, input: unknown) => {
    const ctx = await getRequestContext()
    const parsed = await parseLocalized(decideLeaveSchema, input)
    const request = await hrService.decideLeave(ctx, requestId, parsed)
    await revalidateOrgPath(ctx.organizationId, "/hr")
    return request
  }
)

export const cancelLeaveAction = withAction(async (requestId: string) => {
  const ctx = await getRequestContext()
  const request = await hrService.cancelLeave(ctx, requestId)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return request
})

export const setAllowanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setAllowanceSchema, input)
  const result = await hrService.setAllowance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return result
})

export const adjustBalanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(adjustBalanceSchema, input)
  const adjustment = await hrService.adjustBalance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return adjustment
})

export const updateHrSettingsAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(updateSettingsSchema, input)
  const settings = await hrService.updateSettings(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return settings
})

export const updateProfileAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(updateProfileSchema, input)
  const profile = await hrService.updateProfile(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return profile
})

export const saveClientAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(clientSchema, input)
  const client = await hrService.saveClient(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return client
})

export const saveActivityAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(activitySchema, input)
  const activity = await hrService.saveActivity(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return activity
})

export const updateProjectHrAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(projectHrSchema, input)
  const project = await hrService.updateProjectHr(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return project
})

export const exportCsvAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(exportSchema, input)
  return hrService.exportCsv(ctx, parsed)
})
