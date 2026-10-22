import { prisma } from "@/lib/prisma"

import { MeetingRepository } from "./repository"
import { MeetingService } from "./service"

export const meetingRepository = new MeetingRepository(prisma)
export const meetingService = new MeetingService(meetingRepository)

export { MeetingRepository, MeetingService }
export { resolveMeetingProvider } from "./providers"
export * from "./schemas"
export * from "./types"
