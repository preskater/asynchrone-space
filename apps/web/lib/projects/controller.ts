import { getRequestContext } from "@/lib/core/auth-context"
import { readJson } from "@/lib/core/validation"

import { projectService } from "./index"
import {
  addCommentSchema,
  addLabelSchema,
  addMemberSchema,
  createProjectSchema,
  createTaskSchema,
  createTaskTemplateSchema,
  moveTaskSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
  updateTaskSchema,
  updateTaskTemplateSchema,
} from "./schemas"

export async function listProjects(request: Request) {
  const ctx = await getRequestContext({ request })
  return projectService.list(ctx)
}

export async function createProject(request: Request) {
  const ctx = await getRequestContext({ request })
  const input = createProjectSchema.parse(await readJson(request))
  return projectService.create(ctx, input)
}

export async function getProject(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { projectId } = await params
  return projectService.get(ctx, projectId)
}

export async function updateProject(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { projectId } = await params
  const input = updateProjectSchema.parse(await readJson(request))
  return projectService.update(ctx, projectId, input)
}

export async function deleteProject(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { projectId } = await params
  return projectService.remove(ctx, projectId)
}

export async function listProjectTasks(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { projectId } = await params
  return projectService.listTasks(ctx, projectId)
}

export async function createTask(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { projectId } = await params
  const input = createTaskSchema.parse({
    ...((await readJson(request)) as Record<string, unknown>),
    projectId,
  })
  return projectService.createTask(ctx, input)
}

export async function getTask(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { taskId } = await params
  return projectService.getTask(ctx, taskId)
}

export async function updateTask(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { taskId } = await params
  const input = updateTaskSchema.parse(await readJson(request))
  return projectService.updateTask(ctx, taskId, input)
}

export async function deleteTask(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { taskId } = await params
  return projectService.removeTask(ctx, taskId)
}

export async function moveTask(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { taskId } = await params
  const input = moveTaskSchema.parse(await readJson(request))
  return projectService.moveTask(ctx, taskId, input)
}

export async function addTaskComment(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { taskId } = await params
  const input = addCommentSchema.parse(await readJson(request))
  return projectService.addComment(ctx, taskId, input)
}

export async function listMembers(request: Request) {
  const ctx = await getRequestContext({ request })
  const url = new URL(request.url)
  const limitParam = Number(url.searchParams.get("limit"))
  return projectService.listMembersPage(ctx, {
    cursor: url.searchParams.get("cursor"),
    limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
  })
}

export async function addMember(request: Request) {
  const ctx = await getRequestContext({ request })
  const input = addMemberSchema.parse(await readJson(request))
  return projectService.addMember(ctx, input)
}

export async function removeMember(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { memberId } = await params
  return projectService.removeMember(ctx, memberId)
}

export async function listLabels(request: Request) {
  const ctx = await getRequestContext({ request })
  return projectService.listLabels(ctx)
}

export async function addLabel(request: Request) {
  const ctx = await getRequestContext({ request })
  const input = addLabelSchema.parse(await readJson(request))
  return projectService.addLabel(ctx, input)
}

export async function removeLabel(
  request: Request,
  { params }: { params: Promise<{ labelId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { labelId } = await params
  return projectService.removeLabel(ctx, labelId)
}

export async function listTaskTemplates(request: Request) {
  const ctx = await getRequestContext({ request })
  return projectService.listTemplates(ctx)
}

export async function createTaskTemplate(request: Request) {
  const ctx = await getRequestContext({ request })
  const input = createTaskTemplateSchema.parse(await readJson(request))
  return projectService.createTemplate(ctx, input)
}

export async function updateTaskTemplate(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { templateId } = await params
  const input = updateTaskTemplateSchema.parse(await readJson(request))
  return projectService.updateTemplate(ctx, templateId, input)
}

export async function removeTaskTemplate(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { templateId } = await params
  return projectService.removeTemplate(ctx, templateId)
}
