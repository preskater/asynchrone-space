import { prisma } from "@/lib/prisma"

import { RepositoryConnectionRepository } from "./repository"
import { RepositoryIntegrationService } from "./service"
import { RepositoryWebhookHandler } from "./webhooks"

export const repositoryConnectionRepository =
  new RepositoryConnectionRepository(prisma)
export const repositoryIntegrationService = new RepositoryIntegrationService(
  repositoryConnectionRepository,
  prisma
)
export const repositoryWebhookHandler = new RepositoryWebhookHandler(
  repositoryConnectionRepository,
  prisma
)

export {
  RepositoryConnectionRepository,
  RepositoryIntegrationService,
  RepositoryWebhookHandler,
}
export * from "./schemas"
export { REPOSITORY_PROVIDERS } from "./types"
export type {
  ConnectRepositoryInput,
  ConnectRepositoryResult,
  RepositoryConnectionView,
  RepositoryProvider,
  RepositorySyncSummary,
} from "./types"
export type { TaskSyncUpdate } from "./service"
