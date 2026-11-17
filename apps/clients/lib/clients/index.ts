import { randomUUID } from "node:crypto"

import { ClientsRepository } from "@workspace/clients/repository"
import { ClientsService } from "@workspace/clients/service"

import { recordAuditMany, withActorIdentity } from "@/lib/audit"
import { clientFiles, clientProjects } from "@/lib/clients/ports"
import { emitWebhook, memberDirectory } from "@/lib/identity"
import {
  publicClient,
  publicContact,
  publicDeal,
} from "@/lib/internal/public-resources"
import { notificationService } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"

/**
 * App adapter for the clients domain.
 *
 * `@workspace/clients` owns the repository, service, schemas, types and UI.
 * The app binds the database client, the audit writer and the notification
 * inbox here; the package never imports `apps/clients`.
 */
export const clientsRepository = new ClientsRepository(
  prisma,
  async (entries) => {
    await recordAuditMany(await withActorIdentity(entries), prisma)
    return { count: entries.length }
  },
  {
    directory: {
      async list(organizationId) {
        return (await memberDirectory.list(organizationId)).map((member) => ({
          userId: member.userId,
          name: member.name,
          email: member.email,
          role: member.role,
          clientId: member.clientId,
        }))
      },
    },
    projects: clientProjects,
    files: clientFiles,
  }
)

export const clientsService = new ClientsService(clientsRepository, {
  notify: (args) => notificationService.notify(args),
  emitEvent: async (ctx, event) => {
    const base = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      organizationId: ctx.organizationId,
    }
    if (event.type.startsWith("client.")) {
      if (!event.client) return
      await emitWebhook({
        ...base,
        type: event.type as "client.created" | "client.updated",
        data: { client: publicClient(event.client) },
      })
      return
    }
    if (event.type.startsWith("contact.")) {
      if (!event.contact) return
      await emitWebhook({
        ...base,
        type: event.type as "contact.created" | "contact.updated",
        data: { contact: publicContact(event.contact) },
      })
      return
    }
    if (!event.deal) return
    if (event.type === "deal.stage_changed") {
      await emitWebhook({
        ...base,
        type: "deal.stage_changed",
        data: {
          deal: publicDeal(event.deal),
          previousStageId: event.previousStageId ?? null,
          previousStageName: event.previousStageName ?? null,
        },
      })
      return
    }
    await emitWebhook({
      ...base,
      type: event.type as "deal.created" | "deal.updated",
      data: { deal: publicDeal(event.deal) },
    })
  },
})

export { ClientsRepository, ClientsService }
