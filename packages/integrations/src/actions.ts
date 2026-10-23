"use server"

import { z } from "zod"

import { withAction } from "@workspace/core"
import { getRequestContext } from "@workspace/auth/server"
import { parseLocalized } from "@workspace/core/server"
import {
  connectRepositorySchema,
  repositoryIntegrationService,
  setUserRepositoryTokenSchema,
} from "@workspace/integrations"
import { REPOSITORY_PROVIDERS } from "@workspace/integrations/types"
import { revalidateOrgPath } from "@workspace/auth/server"

const providerSchema = z.enum(REPOSITORY_PROVIDERS)

export const getRepositoryConnectionAction = withAction(
  async (projectId: string) => {
    const ctx = await getRequestContext()
    return repositoryIntegrationService.getConnection(ctx, projectId)
  }
)

export const connectRepositoryAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(connectRepositorySchema, input)
  const result = await repositoryIntegrationService.connect(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, `/projects/${parsed.projectId}`)
  return result
})

export const disconnectRepositoryAction = withAction(
  async (projectId: string) => {
    const ctx = await getRequestContext()
    const result = await repositoryIntegrationService.disconnect(ctx, projectId)
    await revalidateOrgPath(ctx.organizationId, `/projects/${projectId}`)
    return result
  }
)

export const syncRepositoryAction = withAction(async (projectId: string) => {
  const ctx = await getRequestContext()
  const summary = await repositoryIntegrationService.sync(ctx, projectId)
  await revalidateOrgPath(ctx.organizationId, `/projects/${projectId}`)
  return summary
})

// --- personal repository tokens (Account settings) ---

export const listUserRepositoryTokensAction = withAction(async () => {
  const ctx = await getRequestContext()
  return repositoryIntegrationService.listUserTokens(ctx)
})

export const setUserRepositoryTokenAction = withAction(
  async (input: unknown) => {
    const ctx = await getRequestContext()
    const parsed = await parseLocalized(setUserRepositoryTokenSchema, input)
    return repositoryIntegrationService.setUserToken(ctx, parsed)
  }
)

export const removeUserRepositoryTokenAction = withAction(
  async (provider: unknown) => {
    const ctx = await getRequestContext()
    const parsed = await parseLocalized(providerSchema, provider)
    return repositoryIntegrationService.removeUserToken(ctx, parsed)
  }
)
