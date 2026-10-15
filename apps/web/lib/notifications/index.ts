import { prisma } from "@/lib/prisma"

import { NotificationRepository } from "./repository"
import { NotificationService } from "./service"

export const notificationRepository = new NotificationRepository(prisma)
export const notificationService = new NotificationService(notificationRepository)

export { NotificationRepository, NotificationService }
export * from "./schemas"
export * from "./types"
