import type { PrismaClient } from "@workspace/db"

export const calendarInclude = {
  events: {
    orderBy: { startAt: "asc" as const },
    include: { attendees: true },
  },
}

export class CalendarRepository {
  constructor(private readonly db: PrismaClient) {}

  listCalendars(organizationId: string) {
    return this.db.calendar.findMany({
      where: { organizationId },
      include: { members: true },
      orderBy: { createdAt: "asc" },
    })
  }

  findCalendar(organizationId: string, id: string) {
    return this.db.calendar.findFirst({
      where: { id, organizationId },
      include: { members: true },
    })
  }

  createCalendar(data: {
    organizationId: string
    name: string
    kind: string
    color: string
    memberIds: string[]
  }) {
    return this.db.calendar.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        kind: data.kind,
        color: data.color,
        members: {
          create: data.memberIds.map((userId) => ({ userId })),
        },
      },
      include: { members: true },
    })
  }

  setCalendarVisible(id: string, visible: boolean) {
    return this.db.calendar.update({
      where: { id },
      data: { visible },
      include: { members: true },
    })
  }

  deleteCalendar(id: string) {
    return this.db.calendar.delete({ where: { id } })
  }

  /**
   * Events inside a date window. Calendar screens never need the full
   * history, so callers pass a bounded range.
   */
  listEvents(
    organizationId: string,
    options: { from?: Date; to?: Date; take?: number } = {}
  ) {
    return this.db.calendarEvent.findMany({
      where: {
        organizationId,
        ...(options.from || options.to
          ? {
              startAt: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
      include: { attendees: true },
      orderBy: { startAt: "asc" },
      take: options.take ?? 1000,
    })
  }

  findEvent(organizationId: string, id: string) {
    return this.db.calendarEvent.findFirst({
      where: { id, organizationId },
      include: { attendees: true },
    })
  }

  createEvent(data: {
    organizationId: string
    calendarId: string
    title: string
    description?: string
    startAt: Date
    endAt: Date
    allDay: boolean
    location?: string
    meetingUrl?: string
    color: string
    reminderMinutes?: number
    createdBy: string
    attendees: { memberId: string; response: string }[]
  }) {
    return this.db.calendarEvent.create({
      data: {
        organizationId: data.organizationId,
        calendarId: data.calendarId,
        title: data.title,
        description: data.description,
        startAt: data.startAt,
        endAt: data.endAt,
        allDay: data.allDay,
        location: data.location,
        meetingUrl: data.meetingUrl,
        color: data.color,
        reminderMinutes: data.reminderMinutes,
        createdBy: data.createdBy,
        attendees: {
          create: data.attendees.map((attendee) => ({
            userId: attendee.memberId,
            response: attendee.response,
          })),
        },
      },
      include: { attendees: true },
    })
  }

  updateEvent(
    id: string,
    data: {
      title?: string
      description?: string
      startAt?: Date
      endAt?: Date
      allDay?: boolean
      calendarId?: string
      location?: string
      meetingUrl?: string
      color?: string
      reminderMinutes?: number
    }
  ) {
    return this.db.calendarEvent.update({
      where: { id },
      data,
      include: { attendees: true },
    })
  }

  setAttendees(eventId: string, attendees: { memberId: string; response: string }[]) {
    return this.db.$transaction([
      this.db.eventAttendee.deleteMany({ where: { eventId } }),
      this.db.eventAttendee.createMany({
        data: attendees.map((attendee) => ({
          eventId,
          userId: attendee.memberId,
          response: attendee.response,
        })),
        skipDuplicates: true,
      }),
    ])
  }

  setAttendeeResponse(eventId: string, userId: string, response: string) {
    return this.db.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { response },
      create: { eventId, userId, response },
    })
  }

  deleteEvent(id: string) {
    return this.db.calendarEvent.delete({ where: { id } })
  }
}
