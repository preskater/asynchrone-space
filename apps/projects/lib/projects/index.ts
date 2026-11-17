import { randomUUID } from "node:crypto"

import { ProjectRepository } from "@workspace/projects/repository"
import { ProjectService } from "@workspace/projects/service"

import { recordUserAudit } from "@/lib/audit"
import { memberDirectory, emitWebhook } from "@/lib/identity"
import { repositoryIntegrationService } from "@/lib/integrations"
import { publicProject, publicTask } from "@/lib/internal/public-resources"
import { createNotificationService } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"

/**
 * App adapter for the projects domain.
 *
 * `@workspace/projects` owns the repository, service, schemas, types and UI.
 * This file binds the database client, the audit writer, the notification
 * inbox and the repository integration; the package never imports the app.
 */
export const notificationService = createNotificationService()

export const projectRepository = new ProjectRepository(prisma, memberDirectory)

/**
 * Repository sync is built before the service so the service can push task
 * changes. The webhook endpoint stays on Copilot until #190, so newly created
 * connections keep registering the URL that already receives deliveries.
 */
export const projectService = new ProjectService(projectRepository, prisma, {
  audit: recordUserAudit,
  notify: (args) => notificationService.notify(args),
  emitEvent: async (ctx, event) => {
    const base = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      organizationId: ctx.organizationId,
    }
    if (event.type.startsWith("project.")) {
      if (!event.project) return
      await emitWebhook({
        ...base,
        type: event.type as
          "project.created" | "project.updated" | "project.deleted",
        data: { project: publicProject(event.project) },
      })
      return
    }
    if (!event.task) return
    await emitWebhook({
      ...base,
      type: event.type as "task.created" | "task.updated" | "task.deleted",
      data: { task: publicTask(event.task) },
    })
  },
  repository: repositoryIntegrationService,
  directory: memberDirectory,
})

export { ProjectRepository, ProjectService }
