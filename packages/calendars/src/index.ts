import { prisma } from "@workspace/db"

import { CalendarRepository } from "./repository"
import { CalendarService } from "./service"

export const calendarRepository = new CalendarRepository(prisma)
export const calendarService = new CalendarService(calendarRepository)

export { CalendarRepository, CalendarService }
export * from "./schemas"
export type {
  Attendee,
  AttendeeResponse,
  CalendarData,
  CalendarEvent,
  CalendarKind,
  CalendarSource,
  CalendarView,
  EventColor,
} from "./types"
