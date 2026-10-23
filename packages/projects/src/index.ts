import { prisma } from "@workspace/db"

import { ProjectRepository } from "./repository"
import { ProjectService } from "./service"

export const projectRepository = new ProjectRepository(prisma)
export const projectService = new ProjectService(projectRepository, prisma)

export { ProjectRepository, ProjectService }
export * from "./schemas"
export type {
  Activity,
  Comment,
  Label,
  Member,
  Project,
  ProjectData,
  Subtask,
  Task,
  TaskPriority,
  TaskStatus,
} from "./types"

export { ProjectStoreProvider, useProjectStore, initialsFor } from "./store"
export * from "./thread"
export * from "./activity"
export * from "./message-schemas"
