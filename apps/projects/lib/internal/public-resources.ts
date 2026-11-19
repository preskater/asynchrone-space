import {
  PublicProjectSchema,
  PublicTaskSchema,
  type PublicProject,
  type PublicTask,
} from "@workspace/contracts"
import type { Label, Project, TaskSummary } from "@workspace/projects/types"

/** The public API and the webhook emitter share these mappers. */
/** `labels` is the organization's label list; only the project's are kept. */
export function publicProject(
  project: Project,
  labels: readonly Label[]
): PublicProject {
  const byId = new Map(labels.map((label) => [label.id, label]))
  return PublicProjectSchema.parse({
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    status: project.status,
    clientId: project.clientId ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    dueDate: project.dueDate ?? null,
    startDate: project.startDate ?? null,
    endDate: project.endDate ?? null,
    plannedHours: project.plannedHours ?? null,
    isBillable: project.isBillable,
    memberIds: project.memberIds,
    labelIds: project.labelIds,
    labels: project.labelIds.flatMap((id) => {
      const label = byId.get(id)
      return label ? [{ id, name: label.name, color: label.color }] : []
    }),
  })
}

export function publicTask(task: TaskSummary): PublicTask {
  return PublicTaskSchema.parse({
    id: task.id,
    identifier: task.identifier,
    projectId: task.projectId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId ?? null,
    labelIds: task.labelIds,
    dueDate: task.dueDate ?? null,
    endDate: task.endDate ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  })
}
