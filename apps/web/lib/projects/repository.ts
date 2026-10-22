import type { PrismaClient } from "@/lib/generated/prisma/client"

export const projectInclude = {
  client: { select: { id: true, name: true } },
  members: { include: { project: false } },
  labels: { include: { label: true } },
  tasks: {
    orderBy: { order: "asc" as const },
    include: {
      subtasks: { orderBy: { order: "asc" as const } },
      comments: { orderBy: { createdAt: "asc" as const } },
      labels: { include: { label: true } },
    },
  },
  activities: { orderBy: { createdAt: "desc" as const } },
}

export type ProjectWithRelations = Awaited<
  ReturnType<ProjectRepository["findById"]>
>

export class ProjectRepository {
  constructor(private readonly db: PrismaClient) {}

  list(organizationId: string) {
    return this.db.project.findMany({
      where: { organizationId },
      include: projectInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  findById(organizationId: string, id: string) {
    return this.db.project.findFirst({
      where: { id, organizationId },
      include: projectInclude,
    })
  }

  create(
    organizationId: string,
    data: {
      name: string
      description?: string
      status?: string
      memberIds: string[]
      labelIds: string[]
    }
  ) {
    return this.db.project.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        status: data.status ?? "active",
        members: {
          create: data.memberIds.map((userId) => ({ userId })),
        },
        labels: {
          create: data.labelIds.map((labelId) => ({ labelId })),
        },
      },
      include: projectInclude,
    })
  }

  update(
    id: string,
    data: {
      name?: string
      description?: string | null
      status?: string
      dueDate?: Date | null
      clientVisible?: boolean
      clientDiscussion?: string
      clientTaskComments?: string
    }
  ) {
    return this.db.project.update({
      where: { id },
      data,
      include: projectInclude,
    })
  }

  setMembers(projectId: string, userIds: string[]) {
    return this.db.$transaction([
      this.db.projectMember.deleteMany({ where: { projectId } }),
      this.db.projectMember.createMany({
        data: userIds.map((userId) => ({ projectId, userId })),
        skipDuplicates: true,
      }),
    ])
  }

  setLabels(projectId: string, labelIds: string[]) {
    return this.db.$transaction([
      this.db.projectLabel.deleteMany({ where: { projectId } }),
      this.db.projectLabel.createMany({
        data: labelIds.map((labelId) => ({ projectId, labelId })),
        skipDuplicates: true,
      }),
    ])
  }

  delete(id: string) {
    return this.db.project.delete({ where: { id } })
  }

  // --- tasks ---

  listTasks(organizationId: string, projectId: string) {
    return this.db.task.findMany({
      where: { organizationId, projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        subtasks: { orderBy: { order: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
        labels: { include: { label: true } },
      },
    })
  }

  findTask(organizationId: string, id: string) {
    return this.db.task.findFirst({
      where: { id, organizationId },
      include: {
        subtasks: { orderBy: { order: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
        labels: { include: { label: true } },
      },
    })
  }

  countTasksForProject(projectId: string) {
    return this.db.task.count({ where: { projectId } })
  }

  async listTaskIdentifiers(organizationId: string, prefix: string) {
    const rows = await this.db.task.findMany({
      where: { organizationId, identifier: { startsWith: `${prefix}-` } },
      select: { identifier: true },
    })
    return rows.map((row) => row.identifier)
  }

  identifierExists(organizationId: string, identifier: string) {
    return this.db.task.findFirst({
      where: { organizationId, identifier },
      select: { id: true },
    })
  }

  createTask(data: {
    organizationId: string
    projectId: string
    identifier: string
    title: string
    description?: string
    status?: string
    priority?: string
    assigneeId?: string | null
    dueDate?: Date | null
    endDate?: Date | null
    templateId?: string | null
    customFields?: unknown
    order: number
    labelIds: string[]
    externalIssueNumber?: number | null
    externalIssueUrl?: string | null
    externalUpdatedAt?: Date | null
  }) {
    return this.db.task.create({
      data: {
        organizationId: data.organizationId,
        projectId: data.projectId,
        identifier: data.identifier,
        title: data.title,
        description: data.description,
        status: data.status ?? "todo",
        priority: data.priority ?? "medium",
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate ?? null,
        endDate: data.endDate ?? null,
        templateId: data.templateId ?? null,
        customFields: (data.customFields ?? {}) as never,
        order: data.order,
        externalIssueNumber: data.externalIssueNumber ?? null,
        externalIssueUrl: data.externalIssueUrl ?? null,
        externalUpdatedAt: data.externalUpdatedAt ?? null,
        labels: {
          create: data.labelIds.map((labelId) => ({ labelId })),
        },
      },
      include: {
        subtasks: { orderBy: { order: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
        labels: { include: { label: true } },
      },
    })
  }

  updateTask(
    id: string,
    data: {
      title?: string
      description?: string | null
      status?: string
      priority?: string
      assigneeId?: string | null
      dueDate?: Date | null
      endDate?: Date | null
      customFields?: unknown
    }
  ) {
    return this.db.task.update({
      where: { id },
      data: {
        ...data,
        customFields:
          data.customFields === undefined
            ? undefined
            : (data.customFields as never),
      },
      include: {
        subtasks: { orderBy: { order: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
        labels: { include: { label: true } },
      },
    })
  }

  setTaskLabels(taskId: string, labelIds: string[]) {
    return this.db.$transaction([
      this.db.taskLabel.deleteMany({ where: { taskId } }),
      this.db.taskLabel.createMany({
        data: labelIds.map((labelId) => ({ taskId, labelId })),
        skipDuplicates: true,
      }),
    ])
  }

  deleteTask(id: string) {
    return this.db.task.delete({ where: { id } })
  }

  toggleSubtask(subtaskId: string) {
    return this.db.subtask
      .findUniqueOrThrow({ where: { id: subtaskId } })
      .then((subtask) =>
        this.db.subtask.update({
          where: { id: subtaskId },
          data: { done: !subtask.done },
        })
      )
  }

  addComment(
    taskId: string,
    authorId: string,
    body: string,
    options: { authorKind: "internal" | "client"; authorName?: string }
  ) {
    return this.db.taskComment.create({
      data: {
        taskId,
        authorId,
        body,
        authorKind: options.authorKind,
        authorName: options.authorName ?? null,
      },
    })
  }

  // --- activity ---

  addActivity(data: {
    projectId: string
    actorId: string
    action: string
    target: string
  }) {
    return this.db.projectActivity.create({ data })
  }

  // --- labels ---

  listLabels(organizationId: string) {
    return this.db.label.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    })
  }

  createLabel(organizationId: string, name: string, color: string) {
    return this.db.label.create({ data: { organizationId, name, color } })
  }

  findByColor(organizationId: string, color: string) {
    return this.db.label.findFirst({
      where: { organizationId, color: { equals: color, mode: "insensitive" } },
    })
  }

  deleteLabel(id: string) {
    return this.db.label.delete({ where: { id } })
  }

  // --- task templates ---

  listTemplates(organizationId: string) {
    return this.db.taskTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    })
  }

  findTemplate(organizationId: string, id: string) {
    return this.db.taskTemplate.findFirst({
      where: { id, organizationId },
    })
  }

  createTemplate(data: {
    organizationId: string
    projectId: string
    name: string
    description?: string
    status?: string
    priority?: string
    labelIds: string[]
    fields?: unknown
  }) {
    return this.db.taskTemplate.create({
      data: { ...data, fields: data.fields as never },
    })
  }

  updateTemplate(
    id: string,
    data: {
      name?: string
      description?: string | null
      status?: string
      priority?: string
      labelIds?: string[]
      fields?: unknown
    }
  ) {
    return this.db.taskTemplate.update({
      where: { id },
      data: {
        ...data,
        fields: data.fields === undefined ? undefined : (data.fields as never),
      },
    })
  }

  deleteTemplate(id: string) {
    return this.db.taskTemplate.delete({ where: { id } })
  }

  // --- members ---

  listMembers(organizationId: string) {
    return this.db.member.findMany({
      where: { organizationId, clientId: null },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    })
  }

  findMemberByEmail(organizationId: string, email: string) {
    return this.db.member.findFirst({
      where: { organizationId, user: { email } },
      include: { user: true },
    })
  }
}
