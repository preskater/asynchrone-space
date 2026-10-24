"use server"

import { withAction } from "@workspace/core"
import { getRequestContext } from "@workspace/auth/server"
import { parseLocalized } from "@workspace/core/server"
import {
  activitySchema,
  adjustBalanceSchema,
  clearAttendanceSchema,
  clientSchema,
  createLeaveSchema,
  decideLeaveSchema,
  exportSchema,
  fetchRangeSchema,
  employeesService,
  monthKeySchema,
  projectHrSchema,
  setAllowanceSchema,
  setAttendanceSchema,
  setDayStatusSchema,
  updateProfileSchema,
  updateSalarySchema,
  updateSettingsSchema,
} from "@workspace/employees"
import { revalidateOrgPath } from "@workspace/auth/server"

export const fetchAttendanceAction = withAction(
  async (from: string, to: string) => {
    const ctx = await getRequestContext()
    const parsed = fetchRangeSchema.parse({ from, to })
    return employeesService.fetchAttendance(ctx, parsed.from, parsed.to)
  }
)

export const fetchTrackingAction = withAction(
  async (from: string, to: string) => {
    const ctx = await getRequestContext()
    const parsed = fetchRangeSchema.parse({ from, to })
    return employeesService.fetchTracking(ctx, parsed.from, parsed.to)
  }
)

export const fetchPayrollAction = withAction(async (monthKey: string) => {
  const ctx = await getRequestContext()
  const parsed = monthKeySchema.parse(monthKey)
  return employeesService.getPayroll(ctx, parsed)
})

export const setAttendanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setAttendanceSchema, input)
  const entry = await employeesService.setAttendance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return entry
})

export const clearAttendanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(clearAttendanceSchema, input)
  const result = await employeesService.clearAttendance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return result
})

export const setDayStatusAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setDayStatusSchema, input)
  const result = await employeesService.setDayStatus(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return result
})

export const createLeaveAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(createLeaveSchema, input)
  const request = await employeesService.createLeave(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return request
})

export const decideLeaveAction = withAction(
  async (requestId: string, input: unknown) => {
    const ctx = await getRequestContext()
    const parsed = await parseLocalized(decideLeaveSchema, input)
    const request = await employeesService.decideLeave(ctx, requestId, parsed)
    await revalidateOrgPath(ctx.organizationId, "/employees")
    return request
  }
)

export const cancelLeaveAction = withAction(async (requestId: string) => {
  const ctx = await getRequestContext()
  const request = await employeesService.cancelLeave(ctx, requestId)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return request
})

export const setAllowanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setAllowanceSchema, input)
  const result = await employeesService.setAllowance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return result
})

export const adjustBalanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(adjustBalanceSchema, input)
  const adjustment = await employeesService.adjustBalance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return adjustment
})

export const updateHrSettingsAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(updateSettingsSchema, input)
  const settings = await employeesService.updateSettings(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return settings
})

export const updateProfileAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(updateProfileSchema, input)
  const profile = await employeesService.updateProfile(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return profile
})

export const updateSalaryAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(updateSalarySchema, input)
  const salary = await employeesService.updateSalary(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return salary
})

export const saveClientAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(clientSchema, input)
  const client = await employeesService.saveClient(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return client
})

export const saveActivityAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(activitySchema, input)
  const activity = await employeesService.saveActivity(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return activity
})

export const updateProjectHrAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(projectHrSchema, input)
  const project = await employeesService.updateProjectHr(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/employees")
  return project
})

export const exportCsvAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(exportSchema, input)
  return employeesService.exportCsv(ctx, parsed)
})
