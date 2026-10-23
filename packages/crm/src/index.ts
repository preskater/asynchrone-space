import { prisma } from "@workspace/db"

import { CrmRepository } from "./repository"
import { CrmService } from "./service"

export const crmRepository = new CrmRepository(prisma)
export const crmService = new CrmService(crmRepository)

export { CrmRepository, CrmService }
export { resolveCrmAccess } from "./access"
export { isDateKey, parseDateKey, toDateKey } from "./dates"
export * from "./schemas"
export * from "./types"
