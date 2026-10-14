export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "done"

export type TaskPriority = "low" | "medium" | "high" | "urgent"

export type ProjectStatus = "active" | "paused" | "completed"

export type MemberRole = "owner" | "admin" | "member" | "viewer"

export interface Member {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role: MemberRole
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface TaskTemplate {
  id: string
  projectId: string
  name: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  labelIds: string[]
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Comment {
  id: string
  authorId: string
  body: string
  createdAt: string
}

export interface Task {
  id: string
  identifier: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: string
  labelIds: string[]
  dueDate?: string
  endDate?: string
  createdAt: string
  subtasks: Subtask[]
  comments: Comment[]
}

export interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  clientId?: string
  clientName?: string
  memberIds: string[]
  labelIds: string[]
  createdAt: string
  dueDate?: string
}

export interface Activity {
  id: string
  projectId: string
  actorId: string
  action: string
  target: string
  createdAt: string
}

/**
 * Persisted activity `action` values are stable camelCase keys that map to the
 * `Activity` catalog namespace (see `messages/<locale>/activity.json`), e.g.
 * `created`, `moved`, `deleted`, `commentedOn`, `requestedReviewOn`.
 *
 * Task moves additionally need the destination status. Since `target` is a
 * single string, the status value is appended using this sentinel:
 *   `target = "<identifier>__STATUS__<statusValue>"` (e.g. `WEB-3__STATUS__in_progress`).
 * Renderers split on {@link ACTIVITY_STATUS_SENTINEL} and translate the status
 * via `Enums.taskStatus`, then render `Activity.taskMoved` (`"{identifier} to {status}"`).
 */
export const ACTIVITY_STATUS_SENTINEL = "__STATUS__"

export interface ProjectData {
  projects: Project[]
  tasks: Task[]
  members: Member[]
  labels: Label[]
  templates: TaskTemplate[]
  activities: Activity[]
}

export const TASK_STATUS_VALUES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
]

export const TASK_PRIORITY_VALUES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
]

export const PROJECT_STATUS_VALUES: ProjectStatus[] = [
  "active",
  "paused",
  "completed",
]

export const PRIORITY_BADGE_VARIANT: Record<
  TaskPriority,
  "default" | "secondary" | "outline" | "destructive"
> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
}

export function formatDate(value?: string, locale = "en") {
  if (!value) return null
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  })
}
