"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { parseLocalized } from "@/lib/core/validation-server"
import {
  activityInputSchema,
  clientInputSchema,
  closeDealSchema,
  contactInputSchema,
  crmService,
  dealInputSchema,
  deleteFieldDefinitionSchema,
  exportSchema,
  fieldDefinitionSchema,
  importClientsSchema,
  importContactsSchema,
  linkDocumentSchema,
  linkProjectSchema,
  moveDealSchema,
  moveStageSchema,
  pipelineInputSchema,
  reopenDealSchema,
  setDefaultPipelineSchema,
  stageInputSchema,
  unlinkDocumentSchema,
  unlinkProjectSchema,
  updateDocumentVisibilitySchema,
} from "@/lib/crm"
import { revalidateOrgPath } from "@/lib/organization/paths"

/** Activity can surface on the list pages of every record type. */
async function revalidateCrm(organizationId: string) {
  await Promise.all([
    revalidateOrgPath(organizationId, "/clients"),
    revalidateOrgPath(organizationId, "/contacts"),
    revalidateOrgPath(organizationId, "/deals"),
  ])
}

// --- Keyset-paginated list endpoints -----------------------------------------

export const listCrmClientsAction = withAction(
  async (cursor?: string | null) => {
    const ctx = await getRequestContext()
    return crmService.listClientsPage(ctx, { cursor })
  }
)

export const listCrmContactsAction = withAction(
  async (cursor?: string | null) => {
    const ctx = await getRequestContext()
    return crmService.listContactsPage(ctx, { cursor })
  }
)

export const listCrmDealsAction = withAction(
  async (cursor?: string | null) => {
    const ctx = await getRequestContext()
    return crmService.listDealsPage(ctx, { cursor })
  }
)

export const listCrmActivitiesAction = withAction(
  async (input?: {
    cursor?: string | null
    clientId?: string
    contactId?: string
    dealId?: string
  }) => {
    const ctx = await getRequestContext()
    return crmService.listActivitiesPage(ctx, input ?? {})
  }
)

// --- Companies (clients) -----------------------------------------------------

export const saveClientAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(clientInputSchema, input)
  const client = await crmService.saveClient(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/clients")
  return client
})

export const archiveClientAction = withAction(async (clientId: string) => {
  const ctx = await getRequestContext()
  const client = await crmService.archiveClient(ctx, clientId)
  await revalidateOrgPath(ctx.organizationId, "/clients")
  return client
})

export const restoreClientAction = withAction(async (clientId: string) => {
  const ctx = await getRequestContext()
  const client = await crmService.restoreClient(ctx, clientId)
  await revalidateOrgPath(ctx.organizationId, "/clients")
  return client
})

// --- Contacts ----------------------------------------------------------------

export const saveContactAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(contactInputSchema, input)
  const contact = await crmService.saveContact(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/contacts")
  return contact
})

export const archiveContactAction = withAction(async (contactId: string) => {
  const ctx = await getRequestContext()
  const contact = await crmService.archiveContact(ctx, contactId)
  await revalidateOrgPath(ctx.organizationId, "/contacts")
  return contact
})

export const restoreContactAction = withAction(async (contactId: string) => {
  const ctx = await getRequestContext()
  const contact = await crmService.restoreContact(ctx, contactId)
  await revalidateOrgPath(ctx.organizationId, "/contacts")
  return contact
})

// --- Deals -------------------------------------------------------------------

export const saveDealAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(dealInputSchema, input)
  const deal = await crmService.saveDeal(ctx, parsed)
  await revalidateCrm(ctx.organizationId)
  return deal
})

export const moveDealAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(moveDealSchema, input)
  const deal = await crmService.moveDeal(ctx, parsed)
  await revalidateCrm(ctx.organizationId)
  return deal
})

export const closeDealAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(closeDealSchema, input)
  const deal = await crmService.closeDeal(ctx, parsed)
  await revalidateCrm(ctx.organizationId)
  return deal
})

export const reopenDealAction = withAction(async (dealId: string) => {
  const ctx = await getRequestContext()
  reopenDealSchema.parse({ dealId })
  const deal = await crmService.reopenDeal(ctx, dealId)
  await revalidateCrm(ctx.organizationId)
  return deal
})

export const archiveDealAction = withAction(async (dealId: string) => {
  const ctx = await getRequestContext()
  const deal = await crmService.archiveDeal(ctx, dealId)
  await revalidateCrm(ctx.organizationId)
  return deal
})

export const restoreDealAction = withAction(async (dealId: string) => {
  const ctx = await getRequestContext()
  const deal = await crmService.restoreDeal(ctx, dealId)
  await revalidateCrm(ctx.organizationId)
  return deal
})

// --- Pipelines & stages -------------------------------------------------------

export const savePipelineAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(pipelineInputSchema, input)
  const pipeline = await crmService.savePipeline(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/deals")
  return pipeline
})

export const setDefaultPipelineAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(setDefaultPipelineSchema, input)
  const pipeline = await crmService.setDefaultPipeline(
    ctx,
    parsed.pipelineId
  )
  await revalidateOrgPath(ctx.organizationId, "/deals")
  return pipeline
})

export const deletePipelineAction = withAction(async (pipelineId: string) => {
  const ctx = await getRequestContext()
  const result = await crmService.deletePipeline(ctx, pipelineId)
  await revalidateOrgPath(ctx.organizationId, "/deals")
  return result
})

export const saveStageAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(stageInputSchema, input)
  const pipeline = await crmService.saveStage(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/deals")
  return pipeline
})

export const moveStageAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(moveStageSchema, input)
  const pipeline = await crmService.moveStage(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/deals")
  return pipeline
})

export const deleteStageAction = withAction(async (stageId: string) => {
  const ctx = await getRequestContext()
  const pipeline = await crmService.deleteStage(ctx, stageId)
  await revalidateOrgPath(ctx.organizationId, "/deals")
  return pipeline
})

// --- Custom fields --------------------------------------------------------------

export const saveFieldDefinitionAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(fieldDefinitionSchema, input)
  const field = await crmService.saveFieldDefinition(ctx, parsed)
  await revalidateCrm(ctx.organizationId)
  return field
})

export const deleteFieldDefinitionAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(deleteFieldDefinitionSchema, input)
  const result = await crmService.deleteFieldDefinition(ctx, parsed.id)
  await revalidateCrm(ctx.organizationId)
  return result
})

// --- Activities -----------------------------------------------------------------

export const createActivityAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(activityInputSchema, input)
  const activity = await crmService.createActivity(ctx, parsed)
  await revalidateCrm(ctx.organizationId)
  return activity
})

// --- CSV import / export --------------------------------------------------------

export const exportCrmAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(exportSchema, input)
  return crmService.exportCrm(ctx, parsed)
})

export const importClientsAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(importClientsSchema, input)
  const result = await crmService.importClients(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/clients")
  return result
})

export const importContactsAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(importContactsSchema, input)
  const result = await crmService.importContacts(ctx, parsed)
  await revalidateOrgPath(ctx.organizationId, "/contacts")
  return result
})

// --- Documents -------------------------------------------------------------------

export const linkDocumentAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(linkDocumentSchema, input)
  const document = await crmService.linkDocument(ctx, parsed)
  await revalidateCrm(ctx.organizationId)
  return document
})

export const unlinkDocumentAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(unlinkDocumentSchema, input)
  const result = await crmService.unlinkDocument(ctx, parsed.id)
  await revalidateCrm(ctx.organizationId)
  return result
})

export const updateDocumentVisibilityAction = withAction(
  async (input: unknown) => {
    const ctx = await getRequestContext()
    const parsed = await parseLocalized(updateDocumentVisibilitySchema, input)
    const document = await crmService.updateDocumentVisibility(ctx, parsed)
    await revalidateCrm(ctx.organizationId)
    return document
  }
)

export const fetchCrmFileOptionsAction = withAction(async () => {
  const ctx = await getRequestContext()
  return crmService.fetchFileOptions(ctx)
})

// --- Projects --------------------------------------------------------------------

export const linkProjectAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(linkProjectSchema, input)
  const project = await crmService.linkProject(ctx, parsed)
  await Promise.all([
    revalidateCrm(ctx.organizationId),
    revalidateOrgPath(ctx.organizationId, "/projects"),
  ])
  return project
})

export const unlinkProjectAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(unlinkProjectSchema, input)
  const result = await crmService.unlinkProject(ctx, parsed)
  await Promise.all([
    revalidateCrm(ctx.organizationId),
    revalidateOrgPath(ctx.organizationId, "/projects"),
  ])
  return result
})

export const fetchCrmProjectOptionsAction = withAction(async () => {
  const ctx = await getRequestContext()
  return crmService.fetchProjectOptions(ctx)
})
