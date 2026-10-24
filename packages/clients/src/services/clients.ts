import type { RequestContext } from "@workspace/core"
import { ConflictError, NotFoundError } from "@workspace/core"
import type { ClientInput } from "../schemas"
import type { ClientSummaryData } from "../types"
import {
  ClientsServiceCore,
  requireEdit,
  buildClientStats,
  type ClientRow,
  type FieldRow,
} from "./core"

export class ClientRecordsService extends ClientsServiceCore {
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

  private async returnClient(
    ctx: RequestContext,
    id: string
  ): Promise<ClientSummaryData> {
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
      buildClientStats(id, contactRows, dealRows, projectRows),
      row.ownerId ? nameById.get(row.ownerId) : undefined
    )
  }

  async saveClient(
    ctx: RequestContext,
    input: ClientInput
  ): Promise<ClientSummaryData> {
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
        throw new ConflictError("Another company already uses this name.", {
          code: "client_name_taken",
          params: { name: input.name },
        })
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

  async archiveClient(ctx: RequestContext, id: string): Promise<ClientSummaryData> {
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

  async restoreClient(ctx: RequestContext, id: string): Promise<ClientSummaryData> {
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
}
