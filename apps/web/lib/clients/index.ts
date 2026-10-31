import { prisma } from "@/lib/prisma"

import { ClientsRepository } from "./repository"
import { ClientsService } from "./service"

export const clientsRepository = new ClientsRepository(prisma)
export const clientsService = new ClientsService(clientsRepository)

export { ClientsRepository, ClientsService }
export { resolveClientAccess } from "./access"
export { isDateKey, parseDateKey, toDateKey } from "./dates"
export * from "./schemas"
export * from "./types"
