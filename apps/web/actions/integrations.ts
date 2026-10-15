"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { parseLocalized } from "@/lib/core/validation-server"
import {
  connectRepositorySchema,
  repositoryIntegrationService,
} from "@/lib/integrations"
import { revalidateOrgPath } from "@/lib/organization/paths"

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
