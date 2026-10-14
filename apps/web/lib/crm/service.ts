import { toCsv } from "@/lib/core/csv"
import type { RequestContext } from "@/lib/core/context"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/core/errors"

import { parseDateKey, toDateKey } from "./dates"
import { resolveCrmAccess, type CrmAccess } from "./access"
import { CrmRepository } from "./repository"
import type {
  ActivityInput,
  ClientInput,
  CloseDealInput,
  ContactInput,
  DealInput,
  ExportInput,
  FieldDefinitionInput,
  ImportClientsInput,
  ImportContactsInput,
  MoveDealInput,
  MoveStageInput,
  PipelineInput,
  StageInput,
} from "./schemas"
import type {
  CrmAccessData,
  CrmActivityData,
  CrmClientData,
  CrmClientDetailData,
  CrmClientOptionData,
  CrmContactData,
  CrmContactDetailData,
  CrmContactOptionData,
  CrmDealData,
  CrmDealDetailData,
  CrmExportResultData,
  CrmFieldDefinitionData,
  CrmFieldEntity,
  CrmFieldValue,
  CrmFieldValues,
  CrmImportResultData,
  CrmMemberOptionData,
  CrmOverviewData,
  CrmPipelineData,
  CrmProjectOptionData,
  CrmSystemEventData,
  CrmTimelineEntryData,
} from "./types"

const DEFAULT_PIPELINE = {
  name: "Sales pipeline",
  stages: [
    { name: "Lead", type: "open" },
    { name: "Qualified", type: "open" },
    { name: "Proposal", type: "open" },
    { name: "Negotiation", type: "open" },
    { name: "Won", type: "won" },
    { name: "Lost", type: "lost" },
  ],
}

type MemberRow = Awaited<ReturnType<CrmRepository["listMembers"]>>[number]
type ClientRow = Awaited<ReturnType<CrmRepository["listClients"]>>[number]
type ContactRow = Awaited<ReturnType<CrmRepository["listContacts"]>>[number]
type PipelineRow = Awaited<ReturnType<CrmRepository["listPipelines"]>>[number]
type DealRow = Awaited<ReturnType<CrmRepository["listDeals"]>>[number]
type ActivityRow = Awaited<ReturnType<CrmRepository["listActivities"]>>[number]
type FieldRow = Awaited<
  ReturnType<CrmRepository["listFieldDefinitions"]>
>[number]
type AuditRow = Awaited<
  ReturnType<CrmRepository["listAuditForEntity"]>
>[number]
type ProjectOptionRow = Awaited<
  ReturnType<CrmRepository["listProjectOptions"]>
>[number]

interface WorkspaceRows {
  memberRows: MemberRow[]
  clientRows: ClientRow[]
  contactRows: ContactRow[]
  pipelineRows: PipelineRow[]
  dealRows: DealRow[]
  activityRows: ActivityRow[]
  fieldRows: FieldRow[]
  projectRows: ProjectOptionRow[]
}

function requireEdit(access: CrmAccess) {
  if (access.canEdit) return
  throw new ForbiddenError("Your role cannot modify CRM records.", {
    code: "role_cannot_modify_crm",
  })
}

function requireManage(access: CrmAccess) {
  if (access.canManage) return
  throw new ForbiddenError("Your role cannot manage CRM settings.", {
    code: "role_cannot_manage_crm",
  })
}

function requireExport(access: CrmAccess) {
  if (access.canExport) return
  throw new ForbiddenError("Your role cannot export CRM records.", {
    code: "role_cannot_export_crm",
  })
}

function text(value: string | null | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined
}

function slugify(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  )
}

function stringDetails(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") out[key] = item
    if (typeof item === "number" || typeof item === "boolean") {
      out[key] = String(item)
    }
  }
  return out
}

export class CrmService {
  constructor(private readonly repo: CrmRepository) {}

  // ---------------------------------------------------------------------------
  // Access & helpers
  // ---------------------------------------------------------------------------

  private accessFor(ctx: RequestContext): CrmAccess {
    return resolveCrmAccess(ctx)
  }

  private mapMembers(rows: MemberRow[]): CrmMemberOptionData[] {
    return rows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
    }))
  }

  private nameById(memberRows: MemberRow[]): Map<string, string> {
    return new Map(memberRows.map((row) => [row.user.id, row.user.name]))
  }

  private mapFieldDefinition(row: FieldRow): CrmFieldDefinitionData {
    return {
      id: row.id,
      entity: row.entity as CrmFieldEntity,
      key: row.key,
      label: row.label,
      type: row.type as CrmFieldDefinitionData["type"],
      options: Array.isArray(row.options)
        ? (row.options as unknown[]).filter(
            (item): item is string => typeof item === "string"
          )
        : [],
      isRequired: row.isRequired,
      position: row.position,
    }
  }

  private optionsOf(def: FieldRow): string[] {
    return Array.isArray(def.options)
      ? (def.options as unknown[]).filter(
          (item): item is string => typeof item === "string"
        )
      : []
  }

  private coerceFieldValue(def: FieldRow, raw: unknown): CrmFieldValue {
    switch (def.type) {
      case "number": {
        if (raw === null || raw === undefined || raw === "") return null
        const parsed = typeof raw === "number" ? raw : Number(raw)
        if (!Number.isFinite(parsed)) {
          throw new ValidationError(`“${def.label}” must be a number.`)
        }
        return parsed
      }
      case "boolean":
        return raw === true || raw === "true"
      case "date": {
        if (raw === null || raw === undefined || raw === "") return null
        if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          throw new ValidationError(`“${def.label}” must be a date.`)
        }
        return raw
      }
      case "multiselect": {
        const list = Array.isArray(raw)
          ? raw.filter((item): item is string => typeof item === "string")
          : []
        const options = this.optionsOf(def)
        return list.filter((item) => options.includes(item))
      }
      case "select": {
        if (raw === null || raw === undefined || raw === "") return null
        const options = this.optionsOf(def)
        const value = String(raw)
        return options.includes(value) ? value : null
      }
      default: {
        if (raw === null || raw === undefined) return null
        const value = String(raw).trim()
        return value === "" ? null : value
      }
    }
  }

  /**
   * Keep only values for defined fields of the entity, coerce them by type and
   * enforce required fields.
   */
  private normalizeCustomFields(
    defs: FieldRow[],
    entity: CrmFieldEntity,
    raw: unknown
  ): CrmFieldValues {
    const source =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {}
    const values: CrmFieldValues = {}
    for (const def of defs) {
      if (def.entity !== entity) continue
      const value = this.coerceFieldValue(def, source[def.key])
      const empty =
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      if (empty && def.isRequired) {
        throw new ValidationError(
          `“${def.label}” is required.`,
          undefined,
          { code: "custom_field_required", params: { field: def.label } }
        )
      }
      values[def.key] = value
    }
    return values
  }

  private mapClient(
    row: ClientRow,
    stats: {
      contactCount: number
      openDealCount: number
      openDealValue: number
      projectCount: number
    },
    ownerName?: string
  ): CrmClientData {
    return {
      id: row.id,
      name: row.name,
      status: row.status as CrmClientData["status"],
      contactEmail: text(row.contactEmail),
      industry: text(row.industry),
      website: text(row.website),
      phone: text(row.phone),
      address: text(row.address),
      description: text(row.description),
      source: text(row.source),
      ownerId: text(row.ownerId),
      ownerName,
      isActive: row.isActive,
      customFields: (row.customFields ?? {}) as CrmFieldValues,
      archivedAt: row.deletedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...stats,
    }
  }

  private mapContact(
    row: ContactRow,
    openDealCount: number,
    ownerName?: string
  ): CrmContactData {
    const fullName = `${row.firstName} ${row.lastName}`.trim()
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName,
      email: text(row.email),
      phone: text(row.phone),
      jobTitle: text(row.jobTitle),
      notes: text(row.notes),
      ownerId: text(row.ownerId),
      ownerName,
      customFields: (row.customFields ?? {}) as CrmFieldValues,
      companies: row.companies.map((link) => ({
        clientId: link.clientId,
        clientName: link.client.name,
        jobTitle: text(link.jobTitle),
        isPrimary: link.isPrimary,
      })),
      archivedAt: row.deletedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      openDealCount,
    }
  }

  private mapDeal(row: DealRow, ownerName?: string): CrmDealData {
    return {
      id: row.id,
      name: row.name,
      clientId: text(row.clientId),
      clientName: row.client?.name,
      pipelineId: text(row.pipelineId),
      stageId: text(row.stageId),
      stageName: row.stage?.name,
      stageType: (row.stage?.type as CrmDealData["stageType"]) ?? undefined,
      amount: row.amount,
      currency: row.currency,
      probability: row.probability,
      status: row.status as CrmDealData["status"],
      expectedCloseDate: row.expectedCloseDate
        ? toDateKey(row.expectedCloseDate)
        : undefined,
      actualCloseDate: row.actualCloseDate
        ? toDateKey(row.actualCloseDate)
        : undefined,
      lossReason: text(row.lossReason),
      source: text(row.source),
      description: text(row.description),
      ownerId: text(row.ownerId),
      ownerName,
      position: row.position,
      customFields: (row.customFields ?? {}) as CrmFieldValues,
      archivedAt: row.deletedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      contacts: row.contacts.map((link) => ({
        contactId: link.contact.id,
        name: `${link.contact.firstName} ${link.contact.lastName}`.trim(),
        email: text(link.contact.email),
        isPrimary: link.isPrimary,
      })),
    }
  }

  private mapPipeline(row: PipelineRow): CrmPipelineData {
    const deals = row.deals ?? []
    const stages = [...row.stages].sort((a, b) => a.position - b.position)
    return {
      id: row.id,
      name: row.name,
      isDefault: row.isDefault,
      stages: stages.map((stage) => {
        const stageDeals = deals.filter((deal) => deal.stageId === stage.id)
        return {
          id: stage.id,
          name: stage.name,
          position: stage.position,
          type: stage.type as CrmPipelineData["stages"][number]["type"],
          color: text(stage.color),
          dealCount: stageDeals.length,
          totalValue: stageDeals.reduce((sum, deal) => sum + deal.amount, 0),
        }
      }),
    }
  }

  private mapActivity(
    row: ActivityRow,
    nameById: Map<string, string>
  ): CrmActivityData {
    return {
      id: row.id,
      type: row.type as CrmActivityData["type"],
      subject: text(row.subject),
      body: row.body,
      occurredAt: row.occurredAt.toISOString(),
      authorId: row.authorId,
      authorName: nameById.get(row.authorId) ?? "—",
      clientId: text(row.clientId),
      contactId: text(row.contactId),
      dealId: text(row.dealId),
    }
  }

  private mergeTimeline(
    activityRows: ActivityRow[],
    auditRows: AuditRow[],
    nameById: Map<string, string>
  ): CrmTimelineEntryData[] {
    const entries: CrmTimelineEntryData[] = [
      ...activityRows.map((row) => {
        const activity = this.mapActivity(row, nameById)
        return {
          id: `activity-${row.id}`,
          kind: "activity" as const,
          occurredAt: activity.occurredAt,
          activity,
        }
      }),
      ...auditRows.map((row) => {
        const system: CrmSystemEventData = {
          id: row.id,
          action: row.action,
          details: stringDetails(row.after),
          occurredAt: row.createdAt.toISOString(),
          authorName: nameById.get(row.actorId) ?? "—",
        }
        return {
          id: `system-${row.id}`,
          kind: "system" as const,
          occurredAt: system.occurredAt,
          system,
        }
      }),
    ]
    return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }

  /** Lazily seed a default pipeline the first time the CRM is opened. */
  private async ensureDefaultPipeline(organizationId: string) {
    const existing = await this.repo.listPipelines(organizationId)
    if (existing.length > 0) return
    await this.repo.createPipeline(organizationId, {
      name: DEFAULT_PIPELINE.name,
      isDefault: true,
      stages: DEFAULT_PIPELINE.stages.map((stage, index) => ({
        ...stage,
        position: index,
      })),
    })
  }

  private async loadWorkspace(organizationId: string): Promise<WorkspaceRows> {
    const [
      memberRows,
      clientRows,
      contactRows,
      pipelineRows,
      dealRows,
      activityRows,
      fieldRows,
      projectRows,
    ] = await Promise.all([
      this.repo.listMembers(organizationId),
      this.repo.listClients(organizationId),
      this.repo.listContacts(organizationId),
      this.repo.listPipelines(organizationId),
      this.repo.listDeals(organizationId),
      this.repo.listActivities(organizationId, 100),
      this.repo.listFieldDefinitions(organizationId),
      this.repo.listProjectOptions(organizationId),
    ])
    return {
      memberRows,
      clientRows,
      contactRows,
      pipelineRows,
      dealRows,
      activityRows,
      fieldRows,
      projectRows,
    }
  }

  private static buildClientStats(
    clientId: string,
    contactRows: ContactRow[],
    dealRows: DealRow[],
    projectRows: ProjectOptionRow[]
  ) {
    const openDeals = dealRows.filter(
      (deal) =>
        deal.clientId === clientId && deal.status === "open" && !deal.deletedAt
    )
    return {
      contactCount: contactRows.filter(
        (contact) =>
          !contact.deletedAt &&
          contact.companies.some((link) => link.clientId === clientId)
      ).length,
      openDealCount: openDeals.length,
      openDealValue: openDeals.reduce((sum, deal) => sum + deal.amount, 0),
      projectCount: projectRows.filter((project) => project.clientId === clientId)
        .length,
    }
  }

  // ---------------------------------------------------------------------------
  // Overview & details
  // ---------------------------------------------------------------------------

  async getOverview(ctx: RequestContext): Promise<CrmOverviewData> {
    const access = this.accessFor(ctx)
    await this.ensureDefaultPipeline(ctx.organizationId)
    const rows = await this.loadWorkspace(ctx.organizationId)
    const nameById = this.nameById(rows.memberRows)

    const clients = rows.clientRows.map((row) =>
      this.mapClient(
        row,
        CrmService.buildClientStats(
          row.id,
          rows.contactRows,
          rows.dealRows,
          rows.projectRows
        ),
        row.ownerId ? nameById.get(row.ownerId) : undefined
      )
    )

    const contacts = rows.contactRows.map((row) =>
      this.mapContact(
        row,
        rows.dealRows.filter(
          (deal) =>
            !deal.deletedAt &&
            deal.status === "open" &&
            deal.contacts.some((link) => link.contactId === row.id)
        ).length,
        row.ownerId ? nameById.get(row.ownerId) : undefined
      )
    )

    const deals = rows.dealRows.map((row) =>
      this.mapDeal(row, row.ownerId ? nameById.get(row.ownerId) : undefined)
    )

    return {
      todayKey: toDateKey(new Date()),
      access: this.accessData(access, ctx),
      members: this.mapMembers(rows.memberRows),
      fieldDefinitions: rows.fieldRows.map((row) =>
        this.mapFieldDefinition(row)
      ),
      clients,
      contacts,
      pipelines: rows.pipelineRows.map((row) => this.mapPipeline(row)),
      deals,
      recentActivities: rows.activityRows.map((row) =>
        this.mapActivity(row, nameById)
      ),
    }
  }

  private accessData(access: CrmAccess, ctx: RequestContext): CrmAccessData {
    return {
      canEdit: access.canEdit,
      canManage: access.canManage,
      canExport: access.canExport,
      currentUserId: ctx.userId,
    }
  }

  async getClientDetail(
    ctx: RequestContext,
    clientId: string
  ): Promise<CrmClientDetailData> {
    const access = this.accessFor(ctx)
    const [
      row,
      memberRows,
      fieldRows,
      clientRows,
      contactRows,
      dealRows,
      projectRows,
    ] = await Promise.all([
      this.repo.findClient(ctx.organizationId, clientId),
      this.repo.listMembers(ctx.organizationId),
      this.repo.listFieldDefinitions(ctx.organizationId),
      this.repo.listClients(ctx.organizationId),
      this.repo.listContacts(ctx.organizationId),
      this.repo.listDealsByClient(ctx.organizationId, clientId),
      this.repo.listProjectOptions(ctx.organizationId),
    ])
    if (!row) throw new NotFoundError("Client")
    const nameById = this.nameById(memberRows)
    const clientContacts = contactRows
      .filter((contact) =>
        contact.companies.some((link) => link.clientId === clientId)
      )
      .map((contact) =>
        this.mapContact(
          contact,
          dealRows.filter(
            (deal) =>
              !deal.deletedAt &&
              deal.status === "open" &&
              deal.contacts.some((link) => link.contactId === contact.id)
          ).length,
          contact.ownerId ? nameById.get(contact.ownerId) : undefined
        )
      )
    const [activityRows, auditRows] = await Promise.all([
      this.repo.listActivitiesFor(ctx.organizationId, { clientId }, 50),
      this.repo.listAuditForEntity(ctx.organizationId, "client", clientId, 30),
    ])
    return {
      access: this.accessData(access, ctx),
      members: this.mapMembers(memberRows),
      fieldDefinitions: fieldRows.map((field) => this.mapFieldDefinition(field)),
      clients: clientRows
        .filter((client) => !client.deletedAt)
        .map((client): CrmClientOptionData => ({
          id: client.id,
          name: client.name,
        })),
      client: this.mapClient(
        row,
        CrmService.buildClientStats(clientId, contactRows, dealRows, projectRows),
        row.ownerId ? nameById.get(row.ownerId) : undefined
      ),
      contacts: clientContacts,
      deals: dealRows.map((deal) =>
        this.mapDeal(deal, deal.ownerId ? nameById.get(deal.ownerId) : undefined)
      ),
      projects: projectRows
        .filter((project) => project.clientId === clientId)
        .map((project): CrmProjectOptionData => ({
          id: project.id,
          name: project.name,
          status: project.status,
        })),
      timeline: this.mergeTimeline(activityRows, auditRows, nameById),
    }
  }

  async getContactDetail(
    ctx: RequestContext,
    contactId: string
  ): Promise<CrmContactDetailData> {
    const access = this.accessFor(ctx)
    const [row, memberRows, fieldRows, clientRows, dealRows] = await Promise.all([
      this.repo.findContact(ctx.organizationId, contactId),
      this.repo.listMembers(ctx.organizationId),
      this.repo.listFieldDefinitions(ctx.organizationId),
      this.repo.listClients(ctx.organizationId),
      this.repo.listDealsByContact(ctx.organizationId, contactId),
    ])
    if (!row) throw new NotFoundError("Contact")
    const nameById = this.nameById(memberRows)
    const [activityRows, auditRows] = await Promise.all([
      this.repo.listActivitiesFor(ctx.organizationId, { contactId }, 50),
      this.repo.listAuditForEntity(
        ctx.organizationId,
        "contact",
        contactId,
        30
      ),
    ])
    return {
      access: this.accessData(access, ctx),
      members: this.mapMembers(memberRows),
      fieldDefinitions: fieldRows.map((field) => this.mapFieldDefinition(field)),
      clients: clientRows
        .filter((client) => !client.deletedAt)
        .map((client): CrmClientOptionData => ({
          id: client.id,
          name: client.name,
        })),
      contact: this.mapContact(
        row,
        dealRows.filter((deal) => !deal.deletedAt && deal.status === "open")
          .length,
        row.ownerId ? nameById.get(row.ownerId) : undefined
      ),
      deals: dealRows.map((deal) =>
        this.mapDeal(deal, deal.ownerId ? nameById.get(deal.ownerId) : undefined)
      ),
      timeline: this.mergeTimeline(activityRows, auditRows, nameById),
    }
  }

  async getDealDetail(
    ctx: RequestContext,
    dealId: string
  ): Promise<CrmDealDetailData> {
    const access = this.accessFor(ctx)
    await this.ensureDefaultPipeline(ctx.organizationId)
    const [row, memberRows, fieldRows, clientRows, contactRows, pipelineRows] =
      await Promise.all([
        this.repo.findDeal(ctx.organizationId, dealId),
        this.repo.listMembers(ctx.organizationId),
        this.repo.listFieldDefinitions(ctx.organizationId),
        this.repo.listClients(ctx.organizationId),
        this.repo.listContacts(ctx.organizationId),
        this.repo.listPipelines(ctx.organizationId),
      ])
    if (!row) throw new NotFoundError("Deal")
    const nameById = this.nameById(memberRows)
    const [activityRows, auditRows] = await Promise.all([
      this.repo.listActivitiesFor(ctx.organizationId, { dealId }, 50),
      this.repo.listAuditForEntity(ctx.organizationId, "deal", dealId, 30),
    ])
    return {
      access: this.accessData(access, ctx),
      members: this.mapMembers(memberRows),
      fieldDefinitions: fieldRows.map((field) => this.mapFieldDefinition(field)),
      clients: clientRows
        .filter((client) => !client.deletedAt)
        .map((client): CrmClientOptionData => ({
          id: client.id,
          name: client.name,
        })),
      contactOptions: contactRows
        .filter((contact) => !contact.deletedAt)
        .map((contact): CrmContactOptionData => ({
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: text(contact.email),
        })),
      pipelines: pipelineRows.map((pipeline) => this.mapPipeline(pipeline)),
      deal: this.mapDeal(
        row,
        row.ownerId ? nameById.get(row.ownerId) : undefined
      ),
      timeline: this.mergeTimeline(activityRows, auditRows, nameById),
    }
  }

  // ---------------------------------------------------------------------------
  // Companies (clients)
  // ---------------------------------------------------------------------------

  private clientSnapshot(row: ClientRow) {
    return {
      name: row.name,
      status: row.status,
      contactEmail: row.contactEmail,
      industry: row.industry,
      website: row.website,
      phone: row.phone,
      address: row.address,
      source: row.source,
      ownerId: row.ownerId,
      isActive: row.isActive,
    }
  }

  private async clientPayload(
    ctx: RequestContext,
    fieldRows: FieldRow[],
    input: ClientInput
  ) {
    const memberRows = await this.repo.listMembers(ctx.organizationId)
    if (input.ownerId && !memberRows.some((m) => m.user.id === input.ownerId)) {
      throw new NotFoundError("Member")
    }
    return {
      name: input.name,
      status: input.status,
      contactEmail: input.contactEmail ?? null,
      industry: input.industry ?? null,
      website: input.website ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      description: input.description ?? null,
      source: input.source ?? null,
      ownerId: input.ownerId ?? null,
      isActive: input.isActive,
      customFields: this.normalizeCustomFields(
        fieldRows,
        "client",
        input.customFields
      ),
    }
  }

  private async returnClient(ctx: RequestContext, id: string): Promise<CrmClientData> {
    const [row, memberRows, contactRows, dealRows, projectRows] =
      await Promise.all([
        this.repo.findClient(ctx.organizationId, id),
        this.repo.listMembers(ctx.organizationId),
        this.repo.listContacts(ctx.organizationId),
        this.repo.listDeals(ctx.organizationId),
        this.repo.listProjectOptions(ctx.organizationId),
      ])
    if (!row) throw new NotFoundError("Client")
    const nameById = this.nameById(memberRows)
    return this.mapClient(
      row,
      CrmService.buildClientStats(id, contactRows, dealRows, projectRows),
      row.ownerId ? nameById.get(row.ownerId) : undefined
    )
  }

  async saveClient(
    ctx: RequestContext,
    input: ClientInput
  ): Promise<CrmClientData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const fieldRows = await this.repo.listFieldDefinitions(ctx.organizationId)
    const payload = await this.clientPayload(ctx, fieldRows, input)

    if (input.id) {
      const existing = await this.repo.findClient(ctx.organizationId, input.id)
      if (!existing) throw new NotFoundError("Client")
      const duplicate = await this.repo.findClientByName(
        ctx.organizationId,
        input.name
      )
      if (duplicate && duplicate.id !== input.id) {
        throw new ConflictError(
          "Another company already uses this name.",
          { code: "client_name_taken", params: { name: input.name } }
        )
      }
      const row = await this.repo.updateClient(input.id, payload)
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "client.updated",
          entityType: "client",
          entityId: row.id,
          before: this.clientSnapshot(existing),
          after: this.clientSnapshot(row),
        },
      ])
      return this.returnClient(ctx, row.id)
    }

    const duplicate = await this.repo.findClientByName(
      ctx.organizationId,
      input.name
    )
    if (duplicate) {
      throw new ConflictError("Another company already uses this name.", {
        code: "client_name_taken",
        params: { name: input.name },
      })
    }
    const row = await this.repo.createClient({
      organizationId: ctx.organizationId,
      ...payload,
    })
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "client.created",
        entityType: "client",
        entityId: row.id,
        after: this.clientSnapshot(row),
      },
    ])
    return this.returnClient(ctx, row.id)
  }

  async archiveClient(ctx: RequestContext, id: string): Promise<CrmClientData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const existing = await this.repo.findClient(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Client")
    const row = await this.repo.setClientArchived(id, new Date())
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "client.archived",
        entityType: "client",
        entityId: id,
        after: this.clientSnapshot(row),
      },
    ])
    return this.returnClient(ctx, id)
  }

  async restoreClient(ctx: RequestContext, id: string): Promise<CrmClientData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const existing = await this.repo.findClient(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Client")
    const row = await this.repo.setClientArchived(id, null)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "client.restored",
        entityType: "client",
        entityId: id,
        after: this.clientSnapshot(row),
      },
    ])
    return this.returnClient(ctx, id)
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  private contactSnapshot(row: ContactRow) {
    return {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      jobTitle: row.jobTitle,
      ownerId: row.ownerId,
      companies: row.companies.map((link) => link.client.name).join(", "),
    }
  }

  private async contactPayload(
    ctx: RequestContext,
    fieldRows: FieldRow[],
    clientRows: ClientRow[],
    input: ContactInput
  ) {
    const memberRows = await this.repo.listMembers(ctx.organizationId)
    if (input.ownerId && !memberRows.some((m) => m.user.id === input.ownerId)) {
      throw new NotFoundError("Member")
    }
    const knownClients = new Set(clientRows.map((client) => client.id))
    const seen = new Set<string>()
    let hasPrimary = false
    const companies: {
      clientId: string
      jobTitle: string | null
      isPrimary: boolean
    }[] = []
    for (const link of input.companies) {
      if (!knownClients.has(link.clientId)) throw new NotFoundError("Client")
      if (seen.has(link.clientId)) continue
      seen.add(link.clientId)
      const isPrimary = link.isPrimary && !hasPrimary
      if (isPrimary) hasPrimary = true
      companies.push({
        clientId: link.clientId,
        jobTitle: link.jobTitle ?? null,
        isPrimary,
      })
    }
    return {
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        notes: input.notes ?? null,
        ownerId: input.ownerId ?? null,
        customFields: this.normalizeCustomFields(
          fieldRows,
          "contact",
          input.customFields
        ),
      },
      companies,
    }
  }

  private async returnContact(
    ctx: RequestContext,
    id: string
  ): Promise<CrmContactData> {
    const [row, memberRows, dealRows] = await Promise.all([
      this.repo.findContact(ctx.organizationId, id),
      this.repo.listMembers(ctx.organizationId),
      this.repo.listDealsByContact(ctx.organizationId, id),
    ])
    if (!row) throw new NotFoundError("Contact")
    const nameById = this.nameById(memberRows)
    return this.mapContact(
      row,
      dealRows.filter((deal) => !deal.deletedAt && deal.status === "open")
        .length,
      row.ownerId ? nameById.get(row.ownerId) : undefined
    )
  }

  async saveContact(
    ctx: RequestContext,
    input: ContactInput
  ): Promise<CrmContactData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const [fieldRows, clientRows] = await Promise.all([
      this.repo.listFieldDefinitions(ctx.organizationId),
      this.repo.listClients(ctx.organizationId),
    ])
    const payload = await this.contactPayload(
      ctx,
      fieldRows,
      clientRows,
      input
    )

    if (input.email) {
      const duplicate = await this.repo.findContactByEmail(
        ctx.organizationId,
        input.email
      )
      if (duplicate && duplicate.id !== input.id) {
        const name = `${duplicate.firstName} ${duplicate.lastName}`.trim()
        throw new ConflictError(
          `A contact with this email already exists (${name}).`,
          { code: "contact_email_exists", params: { name } }
        )
      }
    }

    if (input.id) {
      const existing = await this.repo.findContact(ctx.organizationId, input.id)
      if (!existing) throw new NotFoundError("Contact")
      const row = await this.repo.updateContact(
        input.id,
        payload.data,
        payload.companies
      )
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "contact.updated",
          entityType: "contact",
          entityId: row.id,
          before: this.contactSnapshot(existing),
          after: this.contactSnapshot(row),
        },
      ])
      return this.returnContact(ctx, row.id)
    }

    const row = await this.repo.createContact(
      { organizationId: ctx.organizationId, ...payload.data },
      payload.companies
    )
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "contact.created",
        entityType: "contact",
        entityId: row.id,
        after: this.contactSnapshot(row),
      },
    ])
    return this.returnContact(ctx, row.id)
  }

  async archiveContact(
    ctx: RequestContext,
    id: string
  ): Promise<CrmContactData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const existing = await this.repo.findContact(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Contact")
    await this.repo.setContactArchived(id, new Date())
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "contact.archived",
        entityType: "contact",
        entityId: id,
      },
    ])
    return this.returnContact(ctx, id)
  }

  async restoreContact(
    ctx: RequestContext,
    id: string
  ): Promise<CrmContactData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const existing = await this.repo.findContact(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Contact")
    await this.repo.setContactArchived(id, null)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "contact.restored",
        entityType: "contact",
        entityId: id,
      },
    ])
    return this.returnContact(ctx, id)
  }

  // ---------------------------------------------------------------------------
  // Deals
  // ---------------------------------------------------------------------------

  private dealSnapshot(row: DealRow) {
    return {
      name: row.name,
      stageId: row.stageId,
      stageName: row.stage?.name ?? null,
      status: row.status,
      amount: row.amount,
      probability: row.probability,
      expectedCloseDate: row.expectedCloseDate
        ? toDateKey(row.expectedCloseDate)
        : null,
      ownerId: row.ownerId,
    }
  }

  private statusForStageType(type: string): "open" | "won" | "lost" {
    if (type === "won") return "won"
    if (type === "lost") return "lost"
    return "open"
  }

  private async dealPayload(
    ctx: RequestContext,
    fieldRows: FieldRow[],
    input: DealInput,
    existing?: DealRow
  ) {
    const [memberRows, clientRows, contactRows, pipelineRows] =
      await Promise.all([
        this.repo.listMembers(ctx.organizationId),
        this.repo.listClients(ctx.organizationId),
        this.repo.listContacts(ctx.organizationId),
        this.repo.listPipelines(ctx.organizationId),
      ])
    if (input.ownerId && !memberRows.some((m) => m.user.id === input.ownerId)) {
      throw new NotFoundError("Member")
    }
    if (input.clientId && !clientRows.some((c) => c.id === input.clientId)) {
      throw new NotFoundError("Client")
    }

    let pipeline = input.pipelineId
      ? pipelineRows.find((row) => row.id === input.pipelineId)
      : (pipelineRows.find((row) => row.isDefault) ?? pipelineRows[0])
    if (input.pipelineId && !pipeline) throw new NotFoundError("Pipeline")
    if (!pipeline) throw new ValidationError("Create a pipeline first.")

    const stage = input.stageId
      ? pipelineRows
          .flatMap((row) => row.stages)
          .find((row) => row.id === input.stageId)
      : pipeline.stages[0]
    if (input.stageId && !stage) throw new NotFoundError("Stage")
    if (!stage) {
      throw new ValidationError("The pipeline has no stages configured.")
    }
    if (input.pipelineId && stage.pipelineId !== pipeline.id) {
      throw new ValidationError("The stage does not belong to this pipeline.")
    }
    pipeline =
      pipelineRows.find((row) => row.id === stage.pipelineId) ?? pipeline

    const knownContacts = new Set(
      contactRows.filter((row) => !row.deletedAt).map((row) => row.id)
    )
    const contactIds: string[] = []
    for (const contactId of input.contactIds) {
      if (!knownContacts.has(contactId)) throw new NotFoundError("Contact")
      if (!contactIds.includes(contactId)) contactIds.push(contactId)
    }

    const status = this.statusForStageType(stage.type)
    const today = new Date()
    const actualCloseDate =
      status === "open" ? null : (existing?.actualCloseDate ?? today)

    return {
      data: {
        name: input.name,
        clientId: input.clientId ?? null,
        pipelineId: pipeline.id,
        stageId: stage.id,
        amount: input.amount,
        currency: input.currency,
        probability: input.probability,
        status,
        expectedCloseDate: input.expectedCloseDate
          ? parseDateKey(input.expectedCloseDate)
          : null,
        actualCloseDate,
        lossReason: status === "lost" ? (existing?.lossReason ?? null) : null,
        source: input.source ?? null,
        description: input.description ?? null,
        ownerId: input.ownerId ?? null,
        customFields: this.normalizeCustomFields(
          fieldRows,
          "deal",
          input.customFields
        ),
      },
      contactIds,
      stage,
    }
  }

  private async returnDeal(ctx: RequestContext, id: string): Promise<CrmDealData> {
    const [row, memberRows] = await Promise.all([
      this.repo.findDeal(ctx.organizationId, id),
      this.repo.listMembers(ctx.organizationId),
    ])
    if (!row) throw new NotFoundError("Deal")
    const nameById = this.nameById(memberRows)
    return this.mapDeal(
      row,
      row.ownerId ? nameById.get(row.ownerId) : undefined
    )
  }

  async saveDeal(ctx: RequestContext, input: DealInput): Promise<CrmDealData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const fieldRows = await this.repo.listFieldDefinitions(ctx.organizationId)

    if (input.id) {
      const existing = await this.repo.findDeal(ctx.organizationId, input.id)
      if (!existing) throw new NotFoundError("Deal")
      const payload = await this.dealPayload(ctx, fieldRows, input, existing)
      const row = await this.repo.updateDeal(
        input.id,
        payload.data,
        payload.contactIds
      )
      const stageChanged = existing.stageId !== row.stageId
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: stageChanged ? "deal.stage_changed" : "deal.updated",
          entityType: "deal",
          entityId: row.id,
          before: this.dealSnapshot(existing),
          after: this.dealSnapshot(row),
        },
      ])
      return this.returnDeal(ctx, row.id)
    }

    const payload = await this.dealPayload(ctx, fieldRows, input)
    const stageDeals = await this.repo.listDeals(ctx.organizationId)
    const position = stageDeals.filter(
      (row) => row.stageId === payload.stage.id && !row.deletedAt
    ).length
    const row = await this.repo.createDeal(
      {
        organizationId: ctx.organizationId,
        ...payload.data,
        position,
      },
      payload.contactIds
    )
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "deal.created",
        entityType: "deal",
        entityId: row.id,
        after: this.dealSnapshot(row),
      },
    ])
    return this.returnDeal(ctx, row.id)
  }

  async moveDeal(ctx: RequestContext, input: MoveDealInput): Promise<CrmDealData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const [deal, stage, dealRows] = await Promise.all([
      this.repo.findDeal(ctx.organizationId, input.dealId),
      this.repo.findStage(ctx.organizationId, input.stageId),
      this.repo.listDeals(ctx.organizationId),
    ])
    if (!deal) throw new NotFoundError("Deal")
    if (!stage) throw new NotFoundError("Stage")

    const stageChanged = deal.stageId !== stage.id
    const status = this.statusForStageType(stage.type)

    const siblings = dealRows
      .filter(
        (row) =>
          row.id !== deal.id && row.stageId === stage.id && !row.deletedAt
      )
      .sort((a, b) => a.position - b.position)
    const index = Math.max(
      0,
      Math.min(input.position ?? siblings.length, siblings.length)
    )
    const orderedIds = siblings.map((row) => row.id)
    orderedIds.splice(index, 0, deal.id)
    await this.repo.updateDealPositions(
      orderedIds.map((id, position) => ({
        id,
        position,
        ...(id === deal.id ? { stageId: stage.id } : {}),
      }))
    )

    let updated = await this.repo.findDeal(ctx.organizationId, deal.id)
    if (!updated) throw new NotFoundError("Deal")

    if (stageChanged) {
      const today = new Date()
      const data: Parameters<CrmRepository["updateDeal"]>[1] = {
        status,
        lossReason:
          stage.type === "lost" ? (input.lossReason ?? null) : null,
        actualCloseDate:
          stage.type === "open" ? null : (deal.actualCloseDate ?? today),
      }
      updated = await this.repo.updateDeal(deal.id, data)
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "deal.stage_changed",
          entityType: "deal",
          entityId: deal.id,
          before: this.dealSnapshot(deal),
          after: this.dealSnapshot(updated),
        },
      ])
    }

    return this.returnDeal(ctx, deal.id)
  }

  async closeDeal(
    ctx: RequestContext,
    input: CloseDealInput
  ): Promise<CrmDealData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const deal = await this.repo.findDeal(ctx.organizationId, input.dealId)
    if (!deal) throw new NotFoundError("Deal")
    const row = await this.repo.updateDeal(input.dealId, {
      status: input.status,
      actualCloseDate: input.actualCloseDate
        ? parseDateKey(input.actualCloseDate)
        : new Date(),
      lossReason: input.status === "lost" ? (input.lossReason ?? null) : null,
    })
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: input.status === "won" ? "deal.won" : "deal.lost",
        entityType: "deal",
        entityId: row.id,
        before: this.dealSnapshot(deal),
        after: this.dealSnapshot(row),
      },
    ])
    return this.returnDeal(ctx, row.id)
  }

  async reopenDeal(ctx: RequestContext, dealId: string): Promise<CrmDealData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const deal = await this.repo.findDeal(ctx.organizationId, dealId)
    if (!deal) throw new NotFoundError("Deal")
    const row = await this.repo.updateDeal(dealId, {
      status: "open",
      actualCloseDate: null,
      lossReason: null,
    })
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "deal.reopened",
        entityType: "deal",
        entityId: row.id,
        before: this.dealSnapshot(deal),
        after: this.dealSnapshot(row),
      },
    ])
    return this.returnDeal(ctx, row.id)
  }

  async archiveDeal(ctx: RequestContext, id: string): Promise<CrmDealData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const existing = await this.repo.findDeal(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Deal")
    await this.repo.setDealArchived(id, new Date())
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "deal.archived",
        entityType: "deal",
        entityId: id,
      },
    ])
    return this.returnDeal(ctx, id)
  }

  async restoreDeal(ctx: RequestContext, id: string): Promise<CrmDealData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const existing = await this.repo.findDeal(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Deal")
    await this.repo.setDealArchived(id, null)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "deal.restored",
        entityType: "deal",
        entityId: id,
      },
    ])
    return this.returnDeal(ctx, id)
  }

  // ---------------------------------------------------------------------------
  // Pipelines & stages
  // ---------------------------------------------------------------------------

  private async returnPipeline(
    ctx: RequestContext,
    pipelineId: string
  ): Promise<CrmPipelineData> {
    const rows = await this.repo.listPipelines(ctx.organizationId)
    const row = rows.find((pipeline) => pipeline.id === pipelineId)
    if (!row) throw new NotFoundError("Pipeline")
    return this.mapPipeline(row)
  }

  async savePipeline(
    ctx: RequestContext,
    input: PipelineInput
  ): Promise<CrmPipelineData> {
    const access = this.accessFor(ctx)
    requireManage(access)
    if (input.id) {
      const existing = await this.repo.findPipeline(
        ctx.organizationId,
        input.id
      )
      if (!existing) throw new NotFoundError("Pipeline")
      await this.repo.updatePipeline(input.id, { name: input.name })
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "pipeline.updated",
          entityType: "pipeline",
          entityId: input.id,
          before: { name: existing.name },
          after: { name: input.name },
        },
      ])
      return this.returnPipeline(ctx, input.id)
    }

    const rows = await this.repo.listPipelines(ctx.organizationId)
    const makeDefault = input.makeDefault || rows.length === 0
    const created = await this.repo.createPipeline(ctx.organizationId, {
      name: input.name,
      isDefault: makeDefault,
      stages: DEFAULT_PIPELINE.stages
        .slice(0, 4)
        .map((stage, index) => ({ ...stage, position: index })),
    })
    if (makeDefault) {
      await this.repo.setOnlyDefaultPipeline(ctx.organizationId, created.id)
    }
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "pipeline.created",
        entityType: "pipeline",
        entityId: created.id,
        after: { name: created.name },
      },
    ])
    return this.returnPipeline(ctx, created.id)
  }

  async setDefaultPipeline(
    ctx: RequestContext,
    pipelineId: string
  ): Promise<CrmPipelineData> {
    const access = this.accessFor(ctx)
    requireManage(access)
    const existing = await this.repo.findPipeline(ctx.organizationId, pipelineId)
    if (!existing) throw new NotFoundError("Pipeline")
    await this.repo.setOnlyDefaultPipeline(ctx.organizationId, pipelineId)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "pipeline.default",
        entityType: "pipeline",
        entityId: pipelineId,
      },
    ])
    return this.returnPipeline(ctx, pipelineId)
  }

  async deletePipeline(
    ctx: RequestContext,
    pipelineId: string
  ): Promise<{ id: string }> {
    const access = this.accessFor(ctx)
    requireManage(access)
    const existing = await this.repo.findPipeline(ctx.organizationId, pipelineId)
    if (!existing) throw new NotFoundError("Pipeline")
    if (existing.isDefault) {
      throw new ConflictError("The default pipeline cannot be deleted.", {
        code: "pipeline_is_default",
      })
    }
    const rows = await this.repo.listPipelines(ctx.organizationId)
    const pipeline = rows.find((row) => row.id === pipelineId)
    const dealCount = pipeline?.deals.length ?? 0
    if (dealCount > 0) {
      throw new ConflictError(
        "Move the deals of this pipeline to another pipeline first.",
        { code: "pipeline_not_empty", params: { count: dealCount } }
      )
    }
    await this.repo.deletePipeline(pipelineId)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "pipeline.deleted",
        entityType: "pipeline",
        entityId: pipelineId,
        before: { name: existing.name },
      },
    ])
    return { id: pipelineId }
  }

  async saveStage(
    ctx: RequestContext,
    input: StageInput
  ): Promise<CrmPipelineData> {
    const access = this.accessFor(ctx)
    requireManage(access)
    const pipeline = await this.repo.findPipeline(
      ctx.organizationId,
      input.pipelineId
    )
    if (!pipeline) throw new NotFoundError("Pipeline")

    if (input.id) {
      const existing = await this.repo.findStage(ctx.organizationId, input.id)
      if (!existing || existing.pipelineId !== input.pipelineId) {
        throw new NotFoundError("Stage")
      }
      await this.repo.updateStage(input.id, {
        name: input.name,
        type: input.type,
        color: input.color ?? null,
      })
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "stage.updated",
          entityType: "pipeline",
          entityId: input.pipelineId,
          before: { name: existing.name, type: existing.type },
          after: { name: input.name, type: input.type },
        },
      ])
      return this.returnPipeline(ctx, input.pipelineId)
    }

    const rows = await this.repo.listPipelines(ctx.organizationId)
    const current = rows.find((row) => row.id === input.pipelineId)
    const position = current ? current.stages.length : 0
    const created = await this.repo.createStage({
      pipelineId: input.pipelineId,
      name: input.name,
      type: input.type,
      position,
      color: input.color ?? null,
    })
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "stage.created",
        entityType: "pipeline",
        entityId: input.pipelineId,
        after: { name: created.name, type: created.type },
      },
    ])
    return this.returnPipeline(ctx, input.pipelineId)
  }

  async moveStage(
    ctx: RequestContext,
    input: MoveStageInput
  ): Promise<CrmPipelineData> {
    const access = this.accessFor(ctx)
    requireManage(access)
    const rows = await this.repo.listPipelines(ctx.organizationId)
    const pipeline = rows.find((row) => row.id === input.pipelineId)
    if (!pipeline) throw new NotFoundError("Pipeline")
    const stages = [...pipeline.stages].sort((a, b) => a.position - b.position)
    const index = stages.findIndex((stage) => stage.id === input.stageId)
    if (index < 0) throw new NotFoundError("Stage")
    const target = input.direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= stages.length) return this.mapPipeline(pipeline)
    const swapped = [...stages]
    const [moved] = swapped.splice(index, 1)
    swapped.splice(target, 0, moved!)
    await this.repo.updateStagePositions(
      swapped.map((stage, position) => ({ id: stage.id, position }))
    )
    return this.returnPipeline(ctx, input.pipelineId)
  }

  async deleteStage(
    ctx: RequestContext,
    stageId: string
  ): Promise<CrmPipelineData> {
    const access = this.accessFor(ctx)
    requireManage(access)
    const stage = await this.repo.findStage(ctx.organizationId, stageId)
    if (!stage) throw new NotFoundError("Stage")
    const rows = await this.repo.listPipelines(ctx.organizationId)
    const pipeline = rows.find((row) => row.id === stage.pipelineId)
    if (pipeline && pipeline.stages.length <= 1) {
      throw new ConflictError("A pipeline needs at least one stage.", {
        code: "stage_last_required",
      })
    }
    const dealCount = await this.repo.countStageDeals(stageId)
    if (dealCount > 0) {
      throw new ConflictError(
        "Move the deals out of this stage before deleting it.",
        { code: "stage_not_empty", params: { count: dealCount } }
      )
    }
    await this.repo.deleteStage(stageId)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "stage.deleted",
        entityType: "pipeline",
        entityId: stage.pipelineId,
        before: { name: stage.name },
      },
    ])
    return this.returnPipeline(ctx, stage.pipelineId)
  }

  // ---------------------------------------------------------------------------
  // Custom field definitions
  // ---------------------------------------------------------------------------

  async saveFieldDefinition(
    ctx: RequestContext,
    input: FieldDefinitionInput
  ): Promise<CrmFieldDefinitionData> {
    const access = this.accessFor(ctx)
    requireManage(access)

    if (input.id) {
      const existing = await this.repo.findFieldDefinition(
        ctx.organizationId,
        input.id
      )
      if (!existing) throw new NotFoundError("Custom field")
      const row = await this.repo.updateFieldDefinition(input.id, {
        label: input.label,
        type: input.type,
        options: input.options,
        isRequired: input.isRequired,
      })
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "crmField.updated",
          entityType: "crmField",
          entityId: row.id,
          before: { label: existing.label, type: existing.type },
          after: { label: row.label, type: row.type },
        },
      ])
      return this.mapFieldDefinition(row)
    }

    const base = slugify(input.label)
    let key = base
    let suffix = 2
    while (
      await this.repo.findFieldDefinitionByKey(
        ctx.organizationId,
        input.entity,
        key
      )
    ) {
      key = `${base}_${suffix}`
      suffix += 1
    }
    const definitions = await this.repo.listFieldDefinitions(ctx.organizationId)
    const position = definitions.filter(
      (row) => row.entity === input.entity
    ).length
    const row = await this.repo.createFieldDefinition({
      organizationId: ctx.organizationId,
      entity: input.entity,
      key,
      label: input.label,
      type: input.type,
      options: input.options,
      isRequired: input.isRequired,
      position,
    })
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "crmField.created",
        entityType: "crmField",
        entityId: row.id,
        after: { key: row.key, label: row.label },
      },
    ])
    return this.mapFieldDefinition(row)
  }

  async deleteFieldDefinition(
    ctx: RequestContext,
    id: string
  ): Promise<{ id: string }> {
    const access = this.accessFor(ctx)
    requireManage(access)
    const existing = await this.repo.findFieldDefinition(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Custom field")
    await this.repo.deleteFieldDefinition(id)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "crmField.deleted",
        entityType: "crmField",
        entityId: id,
        before: { key: existing.key, label: existing.label },
      },
    ])
    return { id }
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  async createActivity(
    ctx: RequestContext,
    input: ActivityInput
  ): Promise<CrmActivityData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const [client, contact, deal] = await Promise.all([
      input.clientId
        ? this.repo.findClient(ctx.organizationId, input.clientId)
        : Promise.resolve(null),
      input.contactId
        ? this.repo.findContact(ctx.organizationId, input.contactId)
        : Promise.resolve(null),
      input.dealId
        ? this.repo.findDeal(ctx.organizationId, input.dealId)
        : Promise.resolve(null),
    ])
    if (input.clientId && !client) throw new NotFoundError("Client")
    if (input.contactId && !contact) throw new NotFoundError("Contact")
    if (input.dealId && !deal) throw new NotFoundError("Deal")

    let occurredAt = new Date()
    if (input.occurredAt) {
      const parsed = new Date(input.occurredAt)
      if (Number.isNaN(parsed.getTime())) {
        throw new ValidationError("Invalid date.")
      }
      occurredAt = parsed
    }

    const row = await this.repo.createActivity({
      organizationId: ctx.organizationId,
      type: input.type,
      subject: input.subject ?? null,
      body: input.body,
      occurredAt,
      authorId: ctx.userId,
      clientId: input.clientId ?? null,
      contactId: input.contactId ?? null,
      dealId: input.dealId ?? null,
    })
    return this.mapActivity(row, new Map([[ctx.userId, ctx.userName]]))
  }

  // ---------------------------------------------------------------------------
  // CSV export / import
  // ---------------------------------------------------------------------------

  async exportCrm(
    ctx: RequestContext,
    input: ExportInput
  ): Promise<CrmExportResultData> {
    const access = this.accessFor(ctx)
    requireExport(access)
    const today = toDateKey(new Date())
    if (input.entity === "clients") {
      const [rows, memberRows] = await Promise.all([
        this.repo.listClients(ctx.organizationId),
        this.repo.listMembers(ctx.organizationId),
      ])
      const nameById = this.nameById(memberRows)
      const csvRows: (string | number)[][] = [
        [
          "Name",
          "Status",
          "Industry",
          "Website",
          "Phone",
          "Address",
          "Contact email",
          "Source",
          "Owner",
          "Active",
          "Created",
        ],
      ]
      for (const row of rows) {
        if (row.deletedAt) continue
        csvRows.push([
          row.name,
          row.status,
          row.industry ?? "",
          row.website ?? "",
          row.phone ?? "",
          row.address ?? "",
          row.contactEmail ?? "",
          row.source ?? "",
          row.ownerId ? (nameById.get(row.ownerId) ?? "") : "",
          row.isActive ? "yes" : "no",
          toDateKey(row.createdAt),
        ])
      }
      return { filename: `presk-clients-${today}.csv`, content: toCsv(csvRows) }
    }

    if (input.entity === "contacts") {
      const [rows, memberRows] = await Promise.all([
        this.repo.listContacts(ctx.organizationId),
        this.repo.listMembers(ctx.organizationId),
      ])
      const nameById = this.nameById(memberRows)
      const csvRows: (string | number)[][] = [
        [
          "First name",
          "Last name",
          "Email",
          "Phone",
          "Job title",
          "Companies",
          "Owner",
          "Created",
        ],
      ]
      for (const row of rows) {
        if (row.deletedAt) continue
        csvRows.push([
          row.firstName,
          row.lastName,
          row.email ?? "",
          row.phone ?? "",
          row.jobTitle ?? "",
          row.companies.map((link) => link.client.name).join(", "),
          row.ownerId ? (nameById.get(row.ownerId) ?? "") : "",
          toDateKey(row.createdAt),
        ])
      }
      return {
        filename: `presk-contacts-${today}.csv`,
        content: toCsv(csvRows),
      }
    }

    const [rows, memberRows] = await Promise.all([
      this.repo.listDeals(ctx.organizationId),
      this.repo.listMembers(ctx.organizationId),
    ])
    const nameById = this.nameById(memberRows)
    const csvRows: (string | number)[][] = [
      [
        "Name",
        "Company",
        "Stage",
        "Status",
        "Amount",
        "Currency",
        "Probability",
        "Expected close",
        "Actual close",
        "Loss reason",
        "Owner",
        "Created",
      ],
    ]
    for (const row of rows) {
      if (row.deletedAt) continue
      csvRows.push([
        row.name,
        row.client?.name ?? "",
        row.stage?.name ?? "",
        row.status,
        row.amount,
        row.currency,
        row.probability,
        row.expectedCloseDate ? toDateKey(row.expectedCloseDate) : "",
        row.actualCloseDate ? toDateKey(row.actualCloseDate) : "",
        row.lossReason ?? "",
        row.ownerId ? (nameById.get(row.ownerId) ?? "") : "",
        toDateKey(row.createdAt),
      ])
    }
    return { filename: `presk-deals-${today}.csv`, content: toCsv(csvRows) }
  }

  async importClients(
    ctx: RequestContext,
    input: ImportClientsInput
  ): Promise<CrmImportResultData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const existing = await this.repo.listClients(ctx.organizationId)
    const byName = new Map(existing.map((row) => [row.name.toLowerCase(), row]))
    const result: CrmImportResultData = {
      created: 0,
      restored: 0,
      skipped: 0,
      errors: [],
    }

    for (const [index, row] of input.rows.entries()) {
      const key = row.name.toLowerCase()
      const found = byName.get(key)
      try {
        if (found) {
          if (found.deletedAt) {
            await this.repo.setClientArchived(found.id, null)
            const updated = await this.repo.updateClient(found.id, {
              status: row.status ?? "prospect",
              industry: row.industry ?? null,
              website: row.website ?? null,
              phone: row.phone ?? null,
              address: row.address ?? null,
              contactEmail: row.contactEmail ?? found.contactEmail ?? null,
              description: row.description ?? null,
              source: row.source ?? null,
            })
            byName.set(key, updated)
            result.restored += 1
          } else {
            result.skipped += 1
          }
          continue
        }
        const created = await this.repo.createClient({
          organizationId: ctx.organizationId,
          name: row.name,
          status: row.status ?? "prospect",
          industry: row.industry ?? null,
          website: row.website ?? null,
          phone: row.phone ?? null,
          address: row.address ?? null,
          contactEmail: row.contactEmail ?? null,
          description: row.description ?? null,
          source: row.source ?? null,
          ownerId: null,
          isActive: true,
        })
        byName.set(key, created)
        result.created += 1
      } catch {
        result.errors.push({ row: index + 1, message: "Could not be imported." })
      }
    }

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "client.import",
        entityType: "client",
        entityId: "import",
        after: {
          created: result.created,
          restored: result.restored,
          skipped: result.skipped,
        },
      },
    ])
    return result
  }

  async importContacts(
    ctx: RequestContext,
    input: ImportContactsInput
  ): Promise<CrmImportResultData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const [existingContacts, clientRows] = await Promise.all([
      this.repo.listContacts(ctx.organizationId),
      this.repo.listClients(ctx.organizationId),
    ])
    const emailSet = new Set(
      existingContacts
        .map((row) => row.email?.toLowerCase())
        .filter((email): email is string => Boolean(email))
    )
    const clientByName = new Map(
      clientRows
        .filter((row) => !row.deletedAt)
        .map((row) => [row.name.toLowerCase(), row])
    )
    const result: CrmImportResultData = {
      created: 0,
      restored: 0,
      skipped: 0,
      errors: [],
    }

    for (const [index, row] of input.rows.entries()) {
      try {
        const email = row.email?.toLowerCase()
        if (email && emailSet.has(email)) {
          result.skipped += 1
          continue
        }
        const company = row.company
          ? clientByName.get(row.company.toLowerCase())
          : undefined
        await this.repo.createContact(
          {
            organizationId: ctx.organizationId,
            firstName: row.firstName,
            lastName: row.lastName ?? "",
            email: row.email ?? null,
            phone: row.phone ?? null,
            jobTitle: row.jobTitle ?? null,
            notes: null,
            ownerId: null,
          },
          company
            ? [{ clientId: company.id, jobTitle: null, isPrimary: true }]
            : []
        )
        if (email) emailSet.add(email)
        result.created += 1
      } catch {
        result.errors.push({ row: index + 1, message: "Could not be imported." })
      }
    }

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "contact.import",
        entityType: "contact",
        entityId: "import",
        after: { created: result.created, skipped: result.skipped },
      },
    ])
    return result
  }
}
