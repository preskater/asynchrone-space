import { ForbiddenError, NotFoundError } from "@/lib/core/errors"
import type { RequestContext } from "@/lib/core/context"
import { roleRank } from "@/lib/organization/roles"

import { CalendarRepository } from "./repository"
import type {
  CreateCalendarInput,
  CreateEventInput,
  MoveEventInput,
  SetAttendeeResponseInput,
  UpdateEventInput,
} from "./schemas"
import type { CalendarData, CalendarEvent, CalendarSource } from "./types"

function canWrite(ctx: RequestContext) {
  if (roleRank(ctx.role) >= 2) return
  throw new ForbiddenError("Your role cannot modify calendars.", {
    code: "role_cannot_modify_calendars",
  })
}

type CalendarRow = Awaited<
  ReturnType<CalendarRepository["listCalendars"]>
>[number]
type EventRow = Awaited<ReturnType<CalendarRepository["listEvents"]>>[number]

export class CalendarService {
  constructor(private readonly repo: CalendarRepository) {}

  private mapCalendar(row: CalendarRow): CalendarSource {
    return {
      id: row.id,
      name: row.name,
      color: row.color as CalendarSource["color"],
      kind: row.kind as CalendarSource["kind"],
      visible: row.visible,
      memberIds: row.members.map((member) => member.userId),
    }
  }

  private mapEvent(row: EventRow): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      allDay: row.allDay,
      calendarId: row.calendarId,
      location: row.location ?? undefined,
      meetingUrl: row.meetingUrl ?? undefined,
      meetingPassword: row.meetingPassword ?? undefined,
      attendees: row.attendees.map((attendee) => ({
        memberId: attendee.userId,
        response:
          attendee.response as CalendarEvent["attendees"][number]["response"],
      })),
      color: row.color as CalendarEvent["color"],
      reminderMinutes: row.reminderMinutes ?? undefined,
      createdBy: row.createdBy,
    }
  }

  async list(ctx: RequestContext): Promise<CalendarData> {
    let calendars = await this.repo.listCalendars(ctx.organizationId)
    if (calendars.length === 0) {
      await this.repo.createCalendar({
        organizationId: ctx.organizationId,
        name: "Personal",
        kind: "personal",
        color: "blue",
        memberIds: [ctx.userId],
      })
      calendars = await this.repo.listCalendars(ctx.organizationId)
    }
    const events = await this.repo.listEvents(ctx.organizationId)
    return {
      calendars: calendars.map((calendar) => this.mapCalendar(calendar)),
      events: events.map((event) => this.mapEvent(event)),
    }
  }

  async createEvent(
    ctx: RequestContext,
    input: CreateEventInput
  ): Promise<CalendarEvent> {
    canWrite(ctx)
    const calendar = await this.repo.findCalendar(
      ctx.organizationId,
      input.calendarId
    )
    if (!calendar) throw new NotFoundError("Calendar")

    const attendees = input.attendees?.length
      ? input.attendees
      : [{ memberId: ctx.userId, response: "accepted" as const }]

    const row = await this.repo.createEvent({
      organizationId: ctx.organizationId,
      calendarId: input.calendarId,
      title: input.title,
      description: input.description,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      allDay: input.allDay ?? false,
      location: input.location,
      meetingUrl: input.meetingUrl,
      color: input.color,
      reminderMinutes: input.reminderMinutes,
      createdBy: ctx.userId,
      attendees,
    })
    return this.mapEvent(row)
  }

  async updateEvent(
    ctx: RequestContext,
    id: string,
    input: UpdateEventInput
  ): Promise<CalendarEvent> {
    canWrite(ctx)
    const existing = await this.repo.findEvent(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Event")
    const row = await this.repo.updateEvent(id, {
      title: input.title,
      description: input.description,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
      endAt: input.endAt ? new Date(input.endAt) : undefined,
      allDay: input.allDay,
      calendarId: input.calendarId,
      location: input.location,
      meetingUrl: input.meetingUrl,
      color: input.color,
      reminderMinutes: input.reminderMinutes,
    })
    return this.mapEvent(row)
  }

  async moveEvent(
    ctx: RequestContext,
    id: string,
    input: MoveEventInput
  ): Promise<CalendarEvent> {
    canWrite(ctx)
    const existing = await this.repo.findEvent(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Event")
    const row = await this.repo.updateEvent(id, {
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
    })
    return this.mapEvent(row)
  }

  async removeEvent(ctx: RequestContext, id: string): Promise<{ id: string }> {
    canWrite(ctx)
    const existing = await this.repo.findEvent(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Event")
    await this.repo.deleteEvent(id)
    return { id }
  }

  async addCalendar(
    ctx: RequestContext,
    input: CreateCalendarInput
  ): Promise<CalendarSource> {
    canWrite(ctx)
    const row = await this.repo.createCalendar({
      organizationId: ctx.organizationId,
      name: input.name,
      kind: input.kind,
      color: input.color,
      memberIds: [ctx.userId],
    })
    return this.mapCalendar(row)
  }

  async toggleCalendar(
    ctx: RequestContext,
    id: string,
    visible?: boolean
  ): Promise<CalendarSource> {
    canWrite(ctx)
    const calendar = await this.repo.findCalendar(ctx.organizationId, id)
    if (!calendar) throw new NotFoundError("Calendar")
    const row = await this.repo.setCalendarVisible(
      id,
      visible ?? !calendar.visible
    )
    return this.mapCalendar(row)
  }

  async setAttendeeResponse(
    ctx: RequestContext,
    eventId: string,
    input: SetAttendeeResponseInput
  ): Promise<CalendarEvent> {
    const existing = await this.repo.findEvent(ctx.organizationId, eventId)
    if (!existing) throw new NotFoundError("Event")
    await this.repo.setAttendeeResponse(eventId, ctx.userId, input.response)
    const row = await this.repo.findEvent(ctx.organizationId, eventId)
    return this.mapEvent(row ?? existing)
  }
}
