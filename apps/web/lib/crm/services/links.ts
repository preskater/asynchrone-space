import type { RequestContext } from "@/lib/core/context"
import { ConflictError, NotFoundError } from "@/lib/core/errors"
import type { LinkProjectInput, UnlinkProjectInput } from "../schemas"
import type { CrmProjectLinkOptionData, CrmProjectOptionData } from "../types"
import { CrmServiceCore, requireEdit } from "./core"

export class CrmLinksService extends CrmServiceCore {
  /** Projects of the organization with their current company, for the picker. */
  async fetchProjectOptions(
    ctx: RequestContext
  ): Promise<CrmProjectLinkOptionData[]> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const rows = await this.repo.listProjectLinkOptions(ctx.organizationId)
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      clientId: row.clientId,
      clientName: row.client?.name ?? null,
    }))
  }

  /** Link a project to a company; re-links it if it had another company. */
  async linkProject(
    ctx: RequestContext,
    input: LinkProjectInput
  ): Promise<CrmProjectOptionData> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const [client, project] = await Promise.all([
      this.repo.findClient(ctx.organizationId, input.clientId),
      this.repo.findProject(ctx.organizationId, input.projectId),
    ])
    if (!client) throw new NotFoundError("Client")
    if (!project) throw new NotFoundError("Project")
    if (project.clientId === input.clientId) {
      throw new ConflictError(
        "This project is already linked to this client.",
        {
          code: "project_already_linked",
        }
      )
    }
    const updated = await this.repo.setProjectClient(
      input.projectId,
      input.clientId
    )
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "client.project.linked",
        entityType: "client",
        entityId: input.clientId,
        after: { projectName: project.name },
      },
    ])
    return { id: updated.id, name: updated.name, status: updated.status }
  }

  async unlinkProject(
    ctx: RequestContext,
    input: UnlinkProjectInput
  ): Promise<{ id: string }> {
    const access = this.accessFor(ctx)
    requireEdit(access)
    const [client, project] = await Promise.all([
      this.repo.findClient(ctx.organizationId, input.clientId),
      this.repo.findProject(ctx.organizationId, input.projectId),
    ])
    if (!client) throw new NotFoundError("Client")
    if (!project) throw new NotFoundError("Project")
    if (project.clientId !== input.clientId) {
      throw new ConflictError("This project is not linked to this client.", {
        code: "project_not_linked",
      })
    }
    await this.repo.setProjectClient(input.projectId, null)
    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "client.project.unlinked",
        entityType: "client",
        entityId: input.clientId,
        after: { projectName: project.name },
      },
    ])
    return { id: input.projectId }
  }
}
