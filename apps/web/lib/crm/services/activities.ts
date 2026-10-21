import type { RequestContext } from "@/lib/core/context"
import { NotFoundError, ValidationError } from "@/lib/core/errors"
import type { ActivityInput } from "../schemas"
import type { CrmActivityData } from "../types"
import { CrmServiceCore, requireEdit } from "./core"

export class CrmActivitiesService extends CrmServiceCore {
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
}
