import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/core/errors"
import { toMemberView } from "@/lib/core/members"
import type { RequestContext } from "@/lib/core/context"
import { notificationService } from "@/lib/notifications"
import { roleRank } from "@/lib/organization/roles"
import type { PrismaClient } from "@/lib/generated/prisma/client"

import { ProjectRepository } from "./repository"
import type {
  AddCommentInput,
  AddLabelInput,
  AddMemberInput,
  CreateProjectInput,
  CreateTaskInput,
  CreateTaskTemplateInput,
  MoveTaskInput,
  UpdateMemberRoleInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateTaskTemplateInput,
} from "./schemas"
import type {
  Activity,
  Label,
  Member,
  Project,
  ProjectData,
  Subtask,
  Task,
  TaskTemplate,
} from "./types"
import { ACTIVITY_STATUS_SENTINEL } from "./types"

const ROLE_RANK: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

function roleAtLeast(role: string, min: number) {
  return (ROLE_RANK[role] ?? 0) >= min
}

function iso(date: Date | null | undefined) {
  return date ? date.toISOString() : undefined
}

function requiredIso(date: Date) {
  return date.toISOString()
}

function taskKey(name: string, tasks: Task[]) {
  const existingPrefix = tasks[0]?.identifier.replace(/-\d+$/, "")
  const base =
    existingPrefix ||
    name
      .replace(/[^a-zA-Z ]/g, "")
      .split(" ")
      .map((word) => word && word[0])
      .join("")
      .toUpperCase()
      .slice(0, 3)
  const count = tasks.filter((task) => task.identifier.startsWith(base)).length
  return `${base || "TSK"}-${count + 1}`
}

type ProjectRow = NonNullable<Awaited<ReturnType<ProjectRepository["findById"]>>>
type TaskRow = Awaited<ReturnType<ProjectRepository["listTasks"]>>[number]
type MemberRow = Awaited<ReturnType<ProjectRepository["listMembers"]>>[number]
type TemplateRow = Awaited<
  ReturnType<ProjectRepository["listTemplates"]>
>[number]

export class ProjectService {
  constructor(
    private readonly repo: ProjectRepository,
    private readonly db: PrismaClient
  ) {}

  private canWrite(ctx: RequestContext) {
    if (roleAtLeast(ctx.role, 2)) return
    throw new ForbiddenError("Your role cannot modify projects.", {
      code: "role_cannot_modify_projects",
    })
  }

  private canManage(ctx: RequestContext) {
    if (roleAtLeast(ctx.role, 3)) return
    throw new ForbiddenError("Your role cannot manage workspace members.", {
      code: "role_cannot_manage_members",
    })
  }

  private mapMember(row: MemberRow): Member {
    return toMemberView(row)
  }

  private mapTemplate(row: TemplateRow): TaskTemplate {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description ?? undefined,
      status: row.status as TaskTemplate["status"],
      priority: row.priority as TaskTemplate["priority"],
      labelIds: row.labelIds,
    }
  }

  private mapProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      status: row.status as Project["status"],
      clientId: row.clientId ?? undefined,
      clientName: row.client?.name,
      memberIds: row.members.map((member) => member.userId),
      labelIds: row.labels.map((label) => label.labelId),
      createdAt: requiredIso(row.createdAt),
      dueDate: iso(row.dueDate),
    }
  }

  private mapTask(row: TaskRow): Task {
    return {
      id: row.id,
      identifier: row.identifier,
      projectId: row.projectId,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status as Task["status"],
      priority: row.priority as Task["priority"],
      assigneeId: row.assigneeId ?? undefined,
      labelIds: row.labels.map((label) => label.labelId),
      dueDate: iso(row.dueDate),
      endDate: iso(row.endDate),
      createdAt: requiredIso(row.createdAt),
      subtasks: row.subtasks.map(
        (subtask): Subtask => ({
          id: subtask.id,
          title: subtask.title,
          done: subtask.done,
        })
      ),
      comments: row.comments.map((comment) => ({
        id: comment.id,
        authorId: comment.authorId,
        body: comment.body,
        createdAt: requiredIso(comment.createdAt),
      })),
    }
  }

  private async listMembersView(ctx: RequestContext): Promise<Member[]> {
    const rows = await this.repo.listMembers(ctx.organizationId)
    return rows
      .map((row) => this.mapMember(row))
      .sort(
        (a, b) =>
          roleRank(b.role) - roleRank(a.role) || a.name.localeCompare(b.name)
      )
  }

  async list(ctx: RequestContext): Promise<ProjectData> {
    const [projects, labels, members, templates] = await Promise.all([
      this.repo.list(ctx.organizationId),
      this.repo.listLabels(ctx.organizationId),
      this.listMembersView(ctx),
      this.repo.listTemplates(ctx.organizationId),
    ])

    const tasks = projects.flatMap((project) =>
      project.tasks.map((task) => this.mapTask(task))
    )

    const activities: Activity[] = projects.flatMap((project) =>
      project.activities.map((activity) => ({
        id: activity.id,
        projectId: activity.projectId,
        actorId: activity.actorId,
        action: activity.action,
        target: activity.target,
        createdAt: requiredIso(activity.createdAt),
      }))
    )

    return {
      projects: projects.map((project) => this.mapProject(project)),
      tasks,
      members,
      labels: labels.map(
        (label): Label => ({
          id: label.id,
          name: label.name,
          color: label.color,
        })
      ),
      templates: templates.map((template): TaskTemplate => ({
        id: template.id,
        projectId: template.projectId,
        name: template.name,
        description: template.description ?? undefined,
        status: template.status as TaskTemplate["status"],
        priority: template.priority as TaskTemplate["priority"],
        labelIds: template.labelIds,
      })),
      activities,
    }
  }

  async get(ctx: RequestContext, id: string): Promise<Project> {
    const row = await this.repo.findById(ctx.organizationId, id)
    if (!row) throw new NotFoundError("Project")
    return this.mapProject(row)
  }

  async create(ctx: RequestContext, input: CreateProjectInput): Promise<Project> {
    this.canWrite(ctx)
    const row = await this.repo.create(ctx.organizationId, {
      name: input.name,
      description: input.description,
      status: input.status,
      memberIds: input.memberIds?.length ? input.memberIds : [ctx.userId],
      labelIds: input.labelIds ?? [],
    })
    return this.mapProject(row)
  }

  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateProjectInput
  ): Promise<Project> {
    this.canWrite(ctx)
    await this.get(ctx, id)
    await this.repo.update(id, {
      name: input.name,
      description: input.description,
      status: input.status,
      dueDate:
        input.dueDate === undefined
          ? undefined
          : input.dueDate === null
            ? null
            : new Date(input.dueDate),
    })
    if (input.memberIds) await this.repo.setMembers(id, input.memberIds)
    if (input.labelIds) await this.repo.setLabels(id, input.labelIds)
    const fresh = await this.repo.findById(ctx.organizationId, id)
    if (!fresh) throw new NotFoundError("Project")
    return this.mapProject(fresh)
  }

  async remove(ctx: RequestContext, id: string): Promise<{ id: string }> {
    this.canWrite(ctx)
    await this.get(ctx, id)
    await this.repo.delete(id)
    return { id }
  }

  async listTasks(ctx: RequestContext, projectId: string): Promise<Task[]> {
    await this.get(ctx, projectId)
    const rows = await this.repo.listTasks(ctx.organizationId, projectId)
    return rows.map((row) => this.mapTask(row))
  }

  async getTask(ctx: RequestContext, id: string): Promise<Task> {
    const row = await this.repo.findTask(ctx.organizationId, id)
    if (!row) throw new NotFoundError("Task")
    return this.mapTask(row)
  }

  async createTask(ctx: RequestContext, input: CreateTaskInput): Promise<Task> {
    this.canWrite(ctx)
    const project = await this.get(ctx, input.projectId)
    const existing = await this.repo.listTasks(ctx.organizationId, input.projectId)
    const identifier = taskKey(
      project.name,
      existing.map((task) => this.mapTask(task))
    )

    const row = await this.repo.createTask({
      organizationId: ctx.organizationId,
      projectId: input.projectId,
      identifier,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      order: existing.length,
      labelIds: input.labelIds ?? [],
    })
    await this.repo.addActivity({
      projectId: input.projectId,
      actorId: ctx.userId,
      action: "created",
      target: identifier,
    })
    await notificationService.notify({
      organizationId: ctx.organizationId,
      userId: input.assigneeId,
      actorId: ctx.userId,
      type: "task.assigned",
      data: {
        taskId: row.id,
        identifier,
        title: input.title,
        projectId: project.id,
        projectName: project.name,
        actorName: ctx.userName,
      },
    })
    return this.mapTask(row)
  }

  async updateTask(
    ctx: RequestContext,
    id: string,
    input: UpdateTaskInput
  ): Promise<Task> {
    this.canWrite(ctx)
    const existing = await this.repo.findTask(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Task")
    await this.repo.updateTask(id, {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueDate:
        input.dueDate === undefined
          ? undefined
          : input.dueDate === null
            ? null
            : new Date(input.dueDate),
      endDate:
        input.endDate === undefined
          ? undefined
          : input.endDate === null
            ? null
            : new Date(input.endDate),
    })
    if (input.labelIds) await this.repo.setTaskLabels(id, input.labelIds)
    if (
      typeof input.assigneeId === "string" &&
      input.assigneeId !== existing.assigneeId
    ) {
      const project = await this.get(ctx, existing.projectId)
      await notificationService.notify({
        organizationId: ctx.organizationId,
        userId: input.assigneeId,
        actorId: ctx.userId,
        type: "task.assigned",
        data: {
          taskId: existing.id,
          identifier: existing.identifier,
          title: input.title ?? existing.title,
          projectId: existing.projectId,
          projectName: project.name,
          actorName: ctx.userName,
        },
      })
    }
    const fresh = await this.repo.findTask(ctx.organizationId, id)
    return this.mapTask(fresh ?? existing)
  }

  async moveTask(
    ctx: RequestContext,
    id: string,
    input: MoveTaskInput
  ): Promise<Task> {
    this.canWrite(ctx)
    const existing = await this.repo.findTask(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Task")
    if (existing.status !== input.status) {
      await this.repo.updateTask(id, { status: input.status })
      await this.repo.addActivity({
        projectId: existing.projectId,
        actorId: ctx.userId,
        action: "moved",
        target: `${existing.identifier}${ACTIVITY_STATUS_SENTINEL}${input.status}`,
      })
    }
    const fresh = await this.repo.findTask(ctx.organizationId, id)
    return this.mapTask(fresh ?? existing)
  }

  async removeTask(ctx: RequestContext, id: string): Promise<{ id: string }> {
    this.canWrite(ctx)
    const existing = await this.repo.findTask(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Task")
    await this.repo.deleteTask(id)
    await this.repo.addActivity({
      projectId: existing.projectId,
      actorId: ctx.userId,
      action: "deleted",
      target: existing.identifier,
    })
    return { id }
  }

  async toggleSubtask(
    ctx: RequestContext,
    taskId: string,
    subtaskId: string
  ): Promise<Task> {
    this.canWrite(ctx)
    const existing = await this.repo.findTask(ctx.organizationId, taskId)
    if (!existing) throw new NotFoundError("Task")
    await this.repo.toggleSubtask(subtaskId)
    const fresh = await this.repo.findTask(ctx.organizationId, taskId)
    return this.mapTask(fresh ?? existing)
  }

  async addComment(
    ctx: RequestContext,
    taskId: string,
    input: AddCommentInput
  ): Promise<Task> {
    this.canWrite(ctx)
    const existing = await this.repo.findTask(ctx.organizationId, taskId)
    if (!existing) throw new NotFoundError("Task")
    await this.repo.addComment(taskId, ctx.userId, input.body)
    await this.repo.addActivity({
      projectId: existing.projectId,
      actorId: ctx.userId,
      action: "commentedOn",
      target: existing.identifier,
    })
    const fresh = await this.repo.findTask(ctx.organizationId, taskId)
    return this.mapTask(fresh ?? existing)
  }

  async listMembers(ctx: RequestContext): Promise<Member[]> {
    return this.listMembersView(ctx)
  }

  async addMember(ctx: RequestContext, input: AddMemberInput): Promise<Member> {
    this.canManage(ctx)
    const existingMember = await this.repo.findMemberByEmail(
      ctx.organizationId,
      input.email
    )
    if (existingMember)
      throw new ConflictError("That email is already a member.", {
        code: "email_already_member",
      })

    const user = await this.db.user.upsert({
      where: { email: input.email },
      update: {},
      create: {
        id: `user_${crypto.randomUUID()}`,
        name: input.name,
        email: input.email,
        emailVerified: false,
      },
    })
    await this.db.member.create({
      data: {
        id: `member_${crypto.randomUUID()}`,
        organizationId: ctx.organizationId,
        userId: user.id,
        role: input.role,
        createdAt: new Date(),
      },
    })
    return toMemberView({
      userId: user.id,
      role: input.role,
      user: { name: user.name, email: user.email, image: user.image },
    })
  }

  async updateMemberRole(
    ctx: RequestContext,
    memberId: string,
    input: UpdateMemberRoleInput
  ): Promise<Member> {
    this.canManage(ctx)
    const member = await this.db.member.findFirst({
      where: { organizationId: ctx.organizationId, userId: memberId },
      include: { user: true },
    })
    if (!member) throw new NotFoundError("Member")
    await this.db.member.update({
      where: { id: member.id },
      data: { role: input.role },
    })
    return toMemberView({ ...member, role: input.role })
  }

  async removeMember(
    ctx: RequestContext,
    memberId: string
  ): Promise<{ id: string }> {
    this.canManage(ctx)
    const member = await this.db.member.findFirst({
      where: { organizationId: ctx.organizationId, userId: memberId },
    })
    if (!member) throw new NotFoundError("Member")
    await this.db.member.delete({ where: { id: member.id } })
    return { id: memberId }
  }

  async listLabels(ctx: RequestContext): Promise<Label[]> {
    const labels = await this.repo.listLabels(ctx.organizationId)
    return labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }))
  }

  async addLabel(ctx: RequestContext, input: AddLabelInput): Promise<Label> {
    this.canWrite(ctx)
    const existing = await this.repo.findByColor(ctx.organizationId, input.color)
    if (existing) {
      throw new ConflictError("That color is already used by another label.", {
        code: "label_color_already_used",
      })
    }
    const label = await this.repo.createLabel(
      ctx.organizationId,
      input.name,
      input.color
    )
    return { id: label.id, name: label.name, color: label.color }
  }

  async removeLabel(ctx: RequestContext, id: string): Promise<{ id: string }> {
    this.canWrite(ctx)
    await this.repo.deleteLabel(id)
    return { id }
  }

  async listTemplates(ctx: RequestContext): Promise<TaskTemplate[]> {
    const rows = await this.repo.listTemplates(ctx.organizationId)
    return rows.map((row) => this.mapTemplate(row))
  }

  async createTemplate(
    ctx: RequestContext,
    input: CreateTaskTemplateInput
  ): Promise<TaskTemplate> {
    this.canManage(ctx)
    await this.get(ctx, input.projectId)
    const row = await this.repo.createTemplate({
      organizationId: ctx.organizationId,
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      status: input.status,
      priority: input.priority,
      labelIds: input.labelIds ?? [],
    })
    return this.mapTemplate(row)
  }

  async updateTemplate(
    ctx: RequestContext,
    id: string,
    input: UpdateTaskTemplateInput
  ): Promise<TaskTemplate> {
    this.canManage(ctx)
    const existing = await this.repo.findTemplate(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Task template")
    const row = await this.repo.updateTemplate(id, {
      name: input.name,
      description: input.description,
      status: input.status,
      priority: input.priority,
      labelIds: input.labelIds,
    })
    return this.mapTemplate(row)
  }

  async removeTemplate(ctx: RequestContext, id: string): Promise<{ id: string }> {
    this.canManage(ctx)
    const existing = await this.repo.findTemplate(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Task template")
    await this.repo.deleteTemplate(id)
    return { id }
  }
}
