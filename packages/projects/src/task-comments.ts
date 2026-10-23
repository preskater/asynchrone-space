import { NotFoundError } from "@workspace/core"
import { notificationService } from "@workspace/notifications"
import { prisma } from "@workspace/db"

export const TASK_COMMENT_MAX_LENGTH = 4000

export interface TaskCommentData {
  id: string
  authorId: string
  authorKind: "internal" | "client"
  authorName?: string
  body: string
  createdAt: string
}

type CommentRow = {
  id: string
  authorId: string
  authorKind: string
  authorName: string | null
  body: string
  createdAt: Date
}

async function namesByIds(ids: string[]): Promise<Map<string, string>> {
  const nameById = new Map<string, string>()
  if (ids.length === 0) return nameById
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  for (const user of users) nameById.set(user.id, user.name)
  return nameById
}

export async function listTaskComments(
  organizationId: string,
  taskId: string
): Promise<TaskCommentData[]> {
  const rows = await prisma.taskComment.findMany({
    where: { taskId, task: { organizationId } },
    orderBy: { createdAt: "asc" },
  })
  const missingNames = [
    ...new Set(
      rows.filter((row) => !row.authorName).map((row) => row.authorId)
    ),
  ]
  const nameById = await namesByIds(missingNames)
  return rows.map((row) => mapComment(row, nameById))
}

function mapComment(
  row: CommentRow,
  nameById: Map<string, string>
): TaskCommentData {
  return {
    id: row.id,
    authorId: row.authorId,
    authorKind: row.authorKind === "client" ? "client" : "internal",
    authorName: row.authorName ?? nameById.get(row.authorId),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Add a comment to a task. Comments from the client notify the internal
 * project members so the team sees them in the header bell.
 */
export async function createTaskComment(input: {
  organizationId: string
  taskId: string
  authorId: string
  authorKind: "internal" | "client"
  authorName?: string
  body: string
}): Promise<TaskCommentData> {
  const task = await prisma.task.findFirst({
    where: { id: input.taskId, organizationId: input.organizationId },
    select: {
      id: true,
      identifier: true,
      title: true,
      projectId: true,
      project: { select: { name: true } },
    },
  })
  if (!task) throw new NotFoundError("Task")

  const row = await prisma.taskComment.create({
    data: {
      taskId: input.taskId,
      authorId: input.authorId,
      authorKind: input.authorKind,
      authorName: input.authorName ?? null,
      body: input.body,
    },
  })

  if (input.authorKind === "client") {
    await notifyTeamOfClientComment(input, task)
  }

  const nameById = await namesByIds(row.authorName ? [] : [row.authorId])
  return mapComment(row, nameById)
}

async function notifyTeamOfClientComment(
  input: {
    organizationId: string
    authorId: string
    authorName?: string
    body: string
  },
  task: {
    id: string
    identifier: string
    title: string
    projectId: string
    project: { name: string } | null
  }
): Promise<void> {
  const members = await prisma.projectMember.findMany({
    where: { projectId: task.projectId },
    select: { userId: true },
  })
  if (members.length === 0) return

  const internalMembers = await prisma.member.findMany({
    where: {
      organizationId: input.organizationId,
      userId: { in: members.map((member) => member.userId) },
      clientId: null,
    },
    select: { userId: true },
  })

  const preview =
    input.body.length > 120 ? `${input.body.slice(0, 117)}...` : input.body
  await Promise.all(
    internalMembers.map((member) =>
      notificationService.notify({
        organizationId: input.organizationId,
        userId: member.userId,
        actorId: input.authorId,
        type: "portal.comment",
        data: {
          projectId: task.projectId,
          projectName: task.project?.name ?? "",
          taskId: task.id,
          identifier: task.identifier,
          title: task.title,
          actorName: input.authorName ?? "",
          preview,
        },
      })
    )
  )
}
