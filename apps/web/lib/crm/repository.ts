import type { PrismaClient } from "@/lib/generated/prisma/client"

/** Columns selecting the company fields shared by every CRM query. */
const CLIENT_SELECT = {
  id: true,
  name: true,
  status: true,
  contactEmail: true,
  industry: true,
  website: true,
  phone: true,
  address: true,
  description: true,
  source: true,
  ownerId: true,
  isActive: true,
  customFields: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export class CrmRepository {
  constructor(private readonly db: PrismaClient) {}

  // --- Members ---------------------------------------------------------------

  listMembers(organizationId: string) {
    return this.db.member.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    })
  }

  // --- Companies (clients) -----------------------------------------------------

  listClients(organizationId: string) {
    return this.db.client.findMany({
      where: { organizationId },
      select: CLIENT_SELECT,
      orderBy: { name: "asc" },
    })
  }

  findClient(organizationId: string, id: string) {
    return this.db.client.findFirst({
      where: { id, organizationId },
      select: CLIENT_SELECT,
    })
  }

  findClientByName(organizationId: string, name: string) {
    return this.db.client.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true, name: true, deletedAt: true },
    })
  }

  createClient(data: {
    organizationId: string
    name: string
    status: string
    contactEmail?: string | null
    industry?: string | null
    website?: string | null
    phone?: string | null
    address?: string | null
    description?: string | null
    source?: string | null
    ownerId?: string | null
    isActive: boolean
    customFields?: unknown
  }) {
    return this.db.client.create({
      data: { ...data, customFields: (data.customFields ?? undefined) as never },
      select: CLIENT_SELECT,
    })
  }

  updateClient(
    id: string,
    data: {
      name?: string
      status?: string
      contactEmail?: string | null
      industry?: string | null
      website?: string | null
      phone?: string | null
      address?: string | null
      description?: string | null
      source?: string | null
      ownerId?: string | null
      isActive?: boolean
      customFields?: unknown
    }
  ) {
    return this.db.client.update({
      where: { id },
      data: { ...data, customFields: data.customFields as never },
      select: CLIENT_SELECT,
    })
  }

  setClientArchived(id: string, deletedAt: Date | null) {
    return this.db.client.update({
      where: { id },
      data: { deletedAt },
      select: CLIENT_SELECT,
    })
  }

  /** Project options used for client detail pages and statistics. */
  listProjectOptions(organizationId: string) {
    return this.db.project.findMany({
      where: { organizationId },
      select: { id: true, name: true, status: true, clientId: true },
      orderBy: { createdAt: "desc" },
    })
  }

  findProject(organizationId: string, id: string) {
    return this.db.project.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, status: true, clientId: true },
    })
  }

  setProjectClient(id: string, clientId: string | null) {
    return this.db.project.update({
      where: { id },
      data: { clientId },
      select: { id: true, name: true, status: true, clientId: true },
    })
  }

  /** Projects with their current company, used by the CRM link picker. */
  listProjectLinkOptions(organizationId: string) {
    return this.db.project.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        status: true,
        clientId: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    })
  }

  // --- Contacts ----------------------------------------------------------------

  listContacts(organizationId: string) {
    return this.db.contact.findMany({
      where: { organizationId },
      include: {
        companies: {
          include: { client: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    })
  }

  findContact(organizationId: string, id: string) {
    return this.db.contact.findFirst({
      where: { id, organizationId },
      include: {
        companies: {
          include: { client: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  }

  findContactByEmail(organizationId: string, email: string) {
    return this.db.contact.findFirst({
      where: {
        organizationId,
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    })
  }

  createContact(
    data: {
      organizationId: string
      firstName: string
      lastName: string
      email?: string | null
      phone?: string | null
      jobTitle?: string | null
      notes?: string | null
      ownerId?: string | null
      customFields?: unknown
    },
    companies: { clientId: string; jobTitle?: string | null; isPrimary: boolean }[]
  ) {
    return this.db.contact.create({
      data: {
        ...data,
        customFields: data.customFields as never,
        companies: { create: companies },
      },
      include: { companies: { include: { client: true } } },
    })
  }

  updateContact(
    id: string,
    data: {
      firstName?: string
      lastName?: string
      email?: string | null
      phone?: string | null
      jobTitle?: string | null
      notes?: string | null
      ownerId?: string | null
      customFields?: unknown
    },
    companies?: { clientId: string; jobTitle?: string | null; isPrimary: boolean }[]
  ) {
    return this.db.contact.update({
      where: { id },
      data: {
        ...data,
        customFields: data.customFields as never,
        ...(companies
          ? { companies: { deleteMany: {}, create: companies } }
          : {}),
      },
      include: { companies: { include: { client: true } } },
    })
  }

  setContactArchived(id: string, deletedAt: Date | null) {
    return this.db.contact.update({
      where: { id },
      data: { deletedAt },
      include: { companies: { include: { client: true } } },
    })
  }

  // --- Pipelines & stages -------------------------------------------------------

  listPipelines(organizationId: string) {
    return this.db.pipeline.findMany({
      where: { organizationId },
      include: {
        stages: { orderBy: { position: "asc" } },
        deals: {
          where: { deletedAt: null },
          select: { id: true, stageId: true, amount: true, status: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })
  }

  findPipeline(organizationId: string, id: string) {
    return this.db.pipeline.findFirst({ where: { id, organizationId } })
  }

  createPipeline(
    organizationId: string,
    data: {
      name: string
      isDefault: boolean
      stages: { name: string; type: string; position: number }[]
    }
  ) {
    return this.db.pipeline.create({
      data: {
        organizationId,
        name: data.name,
        isDefault: data.isDefault,
        stages: { create: data.stages },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    })
  }

  updatePipeline(id: string, data: { name?: string; isDefault?: boolean }) {
    return this.db.pipeline.update({ where: { id }, data })
  }

  deletePipeline(id: string) {
    return this.db.pipeline.delete({ where: { id } })
  }

  setOnlyDefaultPipeline(organizationId: string, id: string) {
    return this.db.$transaction([
      this.db.pipeline.updateMany({
        where: { organizationId, id: { not: id } },
        data: { isDefault: false },
      }),
      this.db.pipeline.update({ where: { id }, data: { isDefault: true } }),
    ])
  }

  findStage(organizationId: string, id: string) {
    return this.db.pipelineStage.findFirst({
      where: { id, pipeline: { organizationId } },
      include: { pipeline: true },
    })
  }

  countStageDeals(stageId: string) {
    return this.db.deal.count({ where: { stageId, deletedAt: null } })
  }

  createStage(data: {
    pipelineId: string
    name: string
    type: string
    position: number
    color?: string | null
  }) {
    return this.db.pipelineStage.create({ data })
  }

  updateStage(
    id: string,
    data: {
      name?: string
      type?: string
      position?: number
      color?: string | null
    }
  ) {
    return this.db.pipelineStage.update({ where: { id }, data })
  }

  deleteStage(id: string) {
    return this.db.pipelineStage.delete({ where: { id } })
  }

  updateStagePositions(entries: { id: string; position: number }[]) {
    return this.db.$transaction(
      entries.map((entry) =>
        this.db.pipelineStage.update({
          where: { id: entry.id },
          data: { position: entry.position },
        })
      )
    )
  }

  // --- Deals ---------------------------------------------------------------------

  private static readonly DEAL_INCLUDE = {
    client: { select: { id: true, name: true } },
    stage: { select: { id: true, name: true, type: true } },
    pipeline: { select: { id: true, name: true } },
    contacts: {
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    },
  } as const

  listDeals(organizationId: string) {
    return this.db.deal.findMany({
      where: { organizationId },
      include: CrmRepository.DEAL_INCLUDE,
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    })
  }

  /** Deals linked to one company. */
  listDealsByClient(organizationId: string, clientId: string) {
    return this.db.deal.findMany({
      where: { organizationId, clientId },
      include: CrmRepository.DEAL_INCLUDE,
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    })
  }

  /** Deals linked to one contact (through the deal-contact join table). */
  listDealsByContact(organizationId: string, contactId: string) {
    return this.db.deal.findMany({
      where: { organizationId, contacts: { some: { contactId } } },
      include: CrmRepository.DEAL_INCLUDE,
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    })
  }

  findDeal(organizationId: string, id: string) {
    return this.db.deal.findFirst({
      where: { id, organizationId },
      include: CrmRepository.DEAL_INCLUDE,
    })
  }

  createDeal(
    data: {
      organizationId: string
      name: string
      clientId?: string | null
      pipelineId?: string | null
      stageId?: string | null
      amount: number
      currency: string
      probability: number
      expectedCloseDate?: Date | null
      source?: string | null
      description?: string | null
      ownerId?: string | null
      position: number
      customFields?: unknown
    },
    contactIds: string[]
  ) {
    return this.db.deal.create({
      data: {
        ...data,
        customFields: data.customFields as never,
        contacts: {
          create: contactIds.map((contactId, index) => ({
            contactId,
            isPrimary: index === 0,
          })),
        },
      },
      include: CrmRepository.DEAL_INCLUDE,
    })
  }

  updateDeal(
    id: string,
    data: {
      name?: string
      clientId?: string | null
      pipelineId?: string | null
      stageId?: string | null
      amount?: number
      currency?: string
      probability?: number
      status?: string
      expectedCloseDate?: Date | null
      actualCloseDate?: Date | null
      lossReason?: string | null
      source?: string | null
      description?: string | null
      ownerId?: string | null
      position?: number
      customFields?: unknown
    },
    contactIds?: string[]
  ) {
    return this.db.deal.update({
      where: { id },
      data: {
        ...data,
        customFields: data.customFields as never,
        ...(contactIds
          ? {
              contacts: {
                deleteMany: {},
                create: contactIds.map((contactId, index) => ({
                  contactId,
                  isPrimary: index === 0,
                })),
              },
            }
          : {}),
      },
      include: CrmRepository.DEAL_INCLUDE,
    })
  }

  setDealArchived(id: string, deletedAt: Date | null) {
    return this.db.deal.update({
      where: { id },
      data: { deletedAt },
      include: CrmRepository.DEAL_INCLUDE,
    })
  }

  updateDealPositions(entries: { id: string; position: number; stageId?: string }[]) {
    return this.db.$transaction(
      entries.map((entry) =>
        this.db.deal.update({
          where: { id: entry.id },
          data: {
            position: entry.position,
            ...(entry.stageId ? { stageId: entry.stageId } : {}),
          },
        })
      )
    )
  }

  // --- Activities ---------------------------------------------------------------

  listActivities(organizationId: string, limit = 100) {
    return this.db.crmActivity.findMany({
      where: { organizationId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    })
  }

  listActivitiesFor(
    organizationId: string,
    where: { clientId?: string; contactId?: string; dealId?: string },
    limit = 50
  ) {
    return this.db.crmActivity.findMany({
      where: { organizationId, ...where },
      orderBy: { occurredAt: "desc" },
      take: limit,
    })
  }

  createActivity(data: {
    organizationId: string
    type: string
    subject?: string | null
    body: string
    occurredAt: Date
    authorId: string
    clientId?: string | null
    contactId?: string | null
    dealId?: string | null
  }) {
    return this.db.crmActivity.create({ data })
  }

  // --- Custom field definitions ---------------------------------------------------

  listFieldDefinitions(organizationId: string) {
    return this.db.crmFieldDefinition.findMany({
      where: { organizationId },
      orderBy: [{ entity: "asc" }, { position: "asc" }],
    })
  }

  findFieldDefinition(organizationId: string, id: string) {
    return this.db.crmFieldDefinition.findFirst({
      where: { id, organizationId },
    })
  }

  findFieldDefinitionByKey(organizationId: string, entity: string, key: string) {
    return this.db.crmFieldDefinition.findFirst({
      where: { organizationId, entity, key },
    })
  }

  createFieldDefinition(data: {
    organizationId: string
    entity: string
    key: string
    label: string
    type: string
    options?: unknown
    isRequired: boolean
    position: number
  }) {
    return this.db.crmFieldDefinition.create({
      data: { ...data, options: data.options as never },
    })
  }

  updateFieldDefinition(
    id: string,
    data: {
      label?: string
      type?: string
      options?: unknown
      isRequired?: boolean
      position?: number
    }
  ) {
    return this.db.crmFieldDefinition.update({
      where: { id },
      data: { ...data, options: data.options as never },
    })
  }

  deleteFieldDefinition(id: string) {
    return this.db.crmFieldDefinition.delete({ where: { id } })
  }

  // --- Documents ------------------------------------------------------------------

  private static readonly DOCUMENT_INCLUDE = {
    file: {
      select: {
        id: true,
        name: true,
        kind: true,
        mimeType: true,
        sizeBytes: true,
        trashed: true,
      },
    },
  } as const

  listDocuments(organizationId: string, entity: string, entityId: string) {
    return this.db.crmDocument.findMany({
      where: { organizationId, entity, entityId },
      include: CrmRepository.DOCUMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    })
  }

  findDocument(organizationId: string, id: string) {
    return this.db.crmDocument.findFirst({
      where: { id, organizationId },
      include: CrmRepository.DOCUMENT_INCLUDE,
    })
  }

  findDocumentLink(
    organizationId: string,
    fileId: string,
    entity: string,
    entityId: string
  ) {
    return this.db.crmDocument.findFirst({
      where: { organizationId, fileId, entity, entityId },
      select: { id: true },
    })
  }

  createDocument(data: {
    organizationId: string
    fileId: string
    entity: string
    entityId: string
    visibility: string
    addedBy: string
  }) {
    return this.db.crmDocument.create({
      data,
      include: CrmRepository.DOCUMENT_INCLUDE,
    })
  }

  updateDocumentVisibility(id: string, visibility: string) {
    return this.db.crmDocument.update({
      where: { id },
      data: { visibility },
      include: CrmRepository.DOCUMENT_INCLUDE,
    })
  }

  deleteDocument(id: string) {
    return this.db.crmDocument.delete({ where: { id } })
  }

  findFileForLink(organizationId: string, fileId: string) {
    return this.db.fileNode.findFirst({
      where: { id: fileId, organizationId },
      select: { id: true, name: true, trashed: true },
    })
  }

  listFileOptions(organizationId: string) {
    return this.db.fileNode.findMany({
      where: { organizationId, trashed: false, kind: { not: "folder" } },
      select: {
        id: true,
        name: true,
        kind: true,
        mimeType: true,
        modifiedAt: true,
      },
      orderBy: { name: "asc" },
    })
  }

  // --- Audit ----------------------------------------------------------------------

  createAudit(
    entries: {
      organizationId: string
      actorId: string
      action: string
      entityType: string
      entityId: string
      before?: unknown
      after?: unknown
    }[]
  ) {
    if (entries.length === 0) return Promise.resolve({ count: 0 })
    return this.db.auditLog.createMany({
      data: entries.map((entry) => ({
        organizationId: entry.organizationId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
      })),
    })
  }

  listAuditForEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    limit = 30
  ) {
    return this.db.auditLog.findMany({
      where: { organizationId, entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  }
}
