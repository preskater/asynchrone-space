import { prisma } from "@workspace/db"

import { MessagingRepository } from "./repository"
import { MessagingService } from "./service"

export const messagingRepository = new MessagingRepository(prisma)
export const messagingService = new MessagingService(messagingRepository)

export { MessagingRepository, MessagingService }
export * from "./schemas"
export type {
  Attachment,
  Conversation,
  ConversationKind,
  Message,
  MessagingData,
  Presence,
  Reaction,
  Team,
} from "./types"
