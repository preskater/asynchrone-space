"use server"

import { withAction } from "@workspace/core"
import { getRequestContext } from "@workspace/auth/server"
import { ForbiddenError, NotFoundError } from "@workspace/core"
import { parseLocalized } from "@workspace/core/server"
import { roleRank } from "@workspace/organization/roles"
import { postProjectMessageSchema } from "./message-schemas"
import { prisma } from "@workspace/db"
import { createProjectMessage, listProjectMessages } from "./thread"

async function requireProject(organizationId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true },
  })
  if (!project) throw new NotFoundError("Project")
  return project
}

/** The shared team ↔ client thread of a project. */
export const listProjectMessagesAction = withAction(async (projectId: string) => {
  const ctx = await getRequestContext()
  await requireProject(ctx.organizationId, String(projectId))
  return listProjectMessages(ctx.organizationId, String(projectId))
})

/** Post a message on the shared thread as a team member. */
export const postProjectMessageAction = withAction(async (input: unknown) => {
  const ctx = await getRequestContext()
  const parsed = await parseLocalized(postProjectMessageSchema, input)
  if (roleRank(ctx.role) < 2) {
    throw new ForbiddenError("Your role cannot post messages.", {
      code: "role_cannot_send_messages",
    })
  }
  await requireProject(ctx.organizationId, parsed.projectId)
  return createProjectMessage({
    organizationId: ctx.organizationId,
    projectId: parsed.projectId,
    authorId: ctx.userId,
    authorKind: "internal",
    body: parsed.body,
  })
})
