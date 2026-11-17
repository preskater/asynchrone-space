"use server"

import { z } from "zod"

import { withAction } from "@workspace/core/action"

import { getRequestContext, requirePermission } from "@/lib/core/auth-context"
import { parseLocalized } from "@/lib/core/validation-server"
import {
  createApiToken,
  createApiTokenSchema,
  revokeApiToken,
} from "@/lib/public-api"

export const createApiTokenAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  requirePermission(ctx, "member:manage")
  const parsed = await parseLocalized(createApiTokenSchema, input)
  return createApiToken(ctx, parsed)
})

export const revokeApiTokenAction = withAction(async (id: string) => {
  const ctx = await getRequestContext()
  requirePermission(ctx, "member:manage")
  return revokeApiToken(ctx, z.string().min(1).parse(id))
})
