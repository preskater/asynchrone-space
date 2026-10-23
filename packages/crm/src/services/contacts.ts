import type { RequestContext } from "@workspace/core"
import { ConflictError, NotFoundError } from "@workspace/core"
import type { ContactInput } from "../schemas"
import type { CrmContactData } from "../types"
import {
  CrmServiceCore,
  requireEdit,
  type ClientRow,
  type ContactRow,
  type FieldRow,
} from "./core"

export class CrmContactsService extends CrmServiceCore {
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
    const payload = await this.contactPayload(ctx, fieldRows, clientRows, input)

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
}
