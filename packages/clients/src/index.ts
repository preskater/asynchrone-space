import { prisma } from "@workspace/db"

import { ClientsRepository } from "./repository"
import { ClientsService } from "./service"

export const clientsRepository = new ClientsRepository(prisma)
export const clientsService = new ClientsService(clientsRepository)

export { ClientsRepository, ClientsService }
export { resolveClientsAccess } from "./access"
export { isDateKey, parseDateKey, toDateKey } from "./dates"
export * from "./schemas"
export * from "./types"
