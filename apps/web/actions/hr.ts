"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { parseLocalized } from "@/lib/core/validation-server"
import {
  createTimeOffRequestSchema,
  decideTimeOffRequestSchema,
  hrService,
  logTimeEntrySchema,
  monthKeySchema,
  setTimeOffAllowanceSchema,
  setWorkLocationSchema,
  updateHrSettingsSchema,
} from "@/lib/hr"
import { revalidateOrgPath } from "@/lib/organization/paths"

export const fetchWorkLocationsAction = withAction(async (month: string) => {
  const ctx = await getRequestContext()
  const parsed = monthKeySchema.parse(month)
  return hrService.listLocations(ctx, parsed)
})

export const setWorkLocationAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setWorkLocationSchema, input)
  const result = await hrService.setWorkLocation(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return result
})

export const createTimeOffRequestAction = withAction(
  async (input: unknown) => {
    const ctx = await getRequestContext()
    const parsed = await parseLocalized(createTimeOffRequestSchema, input)
    const request = await hrService.createTimeOffRequest(ctx, parsed)
    await revalidateOrgPath(ctx.organizationId, "/hr")
    return request
  }
)

export const cancelTimeOffRequestAction = withAction(async (id: string) => {
  const ctx = await getRequestContext()
  const request = await hrService.cancelTimeOffRequest(ctx, id)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return request
})

export const decideTimeOffRequestAction = withAction(
  async (id: string, input: unknown) => {
    const ctx = await getRequestContext()
    const parsed = await parseLocalized(decideTimeOffRequestSchema, input)
    const request = await hrService.decideTimeOffRequest(ctx, id, parsed)
    await revalidateOrgPath(ctx.organizationId, "/hr")
    return request
  }
)

export const setTimeOffAllowanceAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setTimeOffAllowanceSchema, input)
  const balance = await hrService.setTimeOffAllowance(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return balance
})

export const updateHrSettingsAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(updateHrSettingsSchema, input)
  const settings = await hrService.updateSettings(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return settings
})

export const logTimeEntryAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(logTimeEntrySchema, input)
  const entry = await hrService.logTimeEntry(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return entry
})

export const deleteTimeEntryAction = withAction(async (id: string) => {
  const ctx = await getRequestContext()
  const result = await hrService.deleteTimeEntry(ctx, id)
  await revalidateOrgPath(ctx.organizationId, "/hr")
  return result
})
