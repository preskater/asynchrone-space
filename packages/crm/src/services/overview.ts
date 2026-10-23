import type { RequestContext } from "@workspace/core"
import { NotFoundError } from "@workspace/core"
import { toDateKey } from "../dates"
import type { CrmAccess } from "../access"
import type {
  CrmAccessData,
  CrmClientDetailData,
  CrmClientOptionData,
  CrmContactDetailData,
  CrmContactOptionData,
  CrmDealDetailData,
  CrmOverviewData,
  CrmProjectOptionData,
} from "../types"
import { CrmServiceCore, text, buildClientStats } from "./core"

export class CrmOverviewService extends CrmServiceCore {
  async getOverview(ctx: RequestContext): Promise<CrmOverviewData> {
    const access = this.accessFor(ctx)
    await this.ensureDefaultPipeline(ctx.organizationId)
    const rows = await this.loadWorkspace(ctx.organizationId)
    const nameById = this.nameById(rows.memberRows)

    const clients = rows.clientRows.map((row) =>
      this.mapClient(
        row,
        buildClientStats(
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
      documentRows,
    ] = await Promise.all([
      this.repo.findClient(ctx.organizationId, clientId),
      this.repo.listMembers(ctx.organizationId),
      this.repo.listFieldDefinitions(ctx.organizationId),
      this.repo.listClients(ctx.organizationId),
      this.repo.listContacts(ctx.organizationId),
      this.repo.listDealsByClient(ctx.organizationId, clientId),
      this.repo.listProjectOptions(ctx.organizationId),
      this.repo.listDocuments(ctx.organizationId, "client", clientId),
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
      fieldDefinitions: fieldRows.map((field) =>
        this.mapFieldDefinition(field)
      ),
      clients: clientRows
        .filter((client) => !client.deletedAt)
        .map((client): CrmClientOptionData => ({
          id: client.id,
          name: client.name,
        })),
      client: this.mapClient(
        row,
        buildClientStats(clientId, contactRows, dealRows, projectRows),
        row.ownerId ? nameById.get(row.ownerId) : undefined
      ),
      contacts: clientContacts,
      deals: dealRows.map((deal) =>
        this.mapDeal(
          deal,
          deal.ownerId ? nameById.get(deal.ownerId) : undefined
        )
      ),
      projects: projectRows
        .filter((project) => project.clientId === clientId)
        .map((project): CrmProjectOptionData => ({
          id: project.id,
          name: project.name,
          status: project.status,
        })),
      documents: documentRows.map((doc) => this.mapDocument(doc, nameById)),
      timeline: this.mergeTimeline(activityRows, auditRows, nameById),
    }
  }

  async getContactDetail(
    ctx: RequestContext,
    contactId: string
  ): Promise<CrmContactDetailData> {
    const access = this.accessFor(ctx)
    const [row, memberRows, fieldRows, clientRows, dealRows, documentRows] =
      await Promise.all([
        this.repo.findContact(ctx.organizationId, contactId),
        this.repo.listMembers(ctx.organizationId),
        this.repo.listFieldDefinitions(ctx.organizationId),
        this.repo.listClients(ctx.organizationId),
        this.repo.listDealsByContact(ctx.organizationId, contactId),
        this.repo.listDocuments(ctx.organizationId, "contact", contactId),
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
      fieldDefinitions: fieldRows.map((field) =>
        this.mapFieldDefinition(field)
      ),
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
        this.mapDeal(
          deal,
          deal.ownerId ? nameById.get(deal.ownerId) : undefined
        )
      ),
      documents: documentRows.map((doc) => this.mapDocument(doc, nameById)),
      timeline: this.mergeTimeline(activityRows, auditRows, nameById),
    }
  }

  async getDealDetail(
    ctx: RequestContext,
    dealId: string
  ): Promise<CrmDealDetailData> {
    const access = this.accessFor(ctx)
    await this.ensureDefaultPipeline(ctx.organizationId)
    const [
      row,
      memberRows,
      fieldRows,
      clientRows,
      contactRows,
      pipelineRows,
      documentRows,
    ] = await Promise.all([
      this.repo.findDeal(ctx.organizationId, dealId),
      this.repo.listMembers(ctx.organizationId),
      this.repo.listFieldDefinitions(ctx.organizationId),
      this.repo.listClients(ctx.organizationId),
      this.repo.listContacts(ctx.organizationId),
      this.repo.listPipelines(ctx.organizationId),
      this.repo.listDocuments(ctx.organizationId, "deal", dealId),
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
      fieldDefinitions: fieldRows.map((field) =>
        this.mapFieldDefinition(field)
      ),
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
      documents: documentRows.map((doc) => this.mapDocument(doc, nameById)),
      timeline: this.mergeTimeline(activityRows, auditRows, nameById),
    }
  }
}
