import type { PrismaClient } from "@/lib/generated/prisma/client"

export const meetingRequestInclude = {
  client: { select: { id: true, name: true } },
  slots: { orderBy: { position: "asc" as const } },
} as const

const ACTIVE_STATUSES = ["pending", "accepted"]

export class MeetingRepository {
  constructor(private readonly db: PrismaClient) {}

  getSettings(organizationId: string) {
    return this.db.meetingSettings.findUnique({ where: { organizationId } })
  }

  upsertSettings(
    organizationId: string,
    data: {
      clientRequestsEnabled: boolean
      autoDeclineOverlaps: boolean
      bookingWindowDays: number
      minNoticeHours: number
      defaultDurationMinutes: number
      maxDurationMinutes: number
      provider: string
    }
  ) {
    return this.db.meetingSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    })
  }

  listRequests(organizationId: string, limit = 100) {
    return this.db.meetingRequest.findMany({
      where: { organizationId },
      include: meetingRequestInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
    })
  }

  listClientRequests(organizationId: string, clientId: string, limit = 50) {
    return this.db.meetingRequest.findMany({
      where: { organizationId, clientId },
      include: meetingRequestInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  }

  findRequest(organizationId: string, id: string) {
    return this.db.meetingRequest.findFirst({
      where: { id, organizationId },
      include: meetingRequestInclude,
    })
  }

  findClientRequest(organizationId: string, clientId: string, id: string) {
    return this.db.meetingRequest.findFirst({
      where: { id, organizationId, clientId },
      include: meetingRequestInclude,
    })
  }

  createRequest(data: {
    organizationId: string
    clientId: string
    title: string
    description?: string
    mode: string
    meetingUrl?: string
    meetingPassword?: string
    address?: string
    requestedById: string
    requestedByName: string
    slots: { startAt: Date; endAt: Date }[]
  }) {
    const { slots, ...request } = data
    return this.db.meetingRequest.create({
      data: {
        ...request,
        slots: {
          create: slots.map((slot, position) => ({
            startAt: slot.startAt,
            endAt: slot.endAt,
            position,
          })),
        },
      },
      include: meetingRequestInclude,
    })
  }

  updateRequest(
    id: string,
    data: {
      status?: string
      decidedById?: string
      decidedByName?: string
      decidedAt?: Date
      decisionNote?: string | null
      calendarEventId?: string | null
      provider?: string
      externalMeetingId?: string | null
      externalJoinUrl?: string | null
      meetingUrl?: string | null
      meetingPassword?: string | null
      address?: string | null
    }
  ) {
    return this.db.meetingRequest.update({
      where: { id },
      data,
      include: meetingRequestInclude,
    })
  }

  /**
   * For each proposed slot, whether it overlaps another pending/accepted
   * request or an event booked on a team calendar.
   */
  async findSlotConflicts(
    organizationId: string,
    slots: { startAt: Date; endAt: Date }[],
    excludeRequestId?: string
  ): Promise<boolean[]> {
    if (slots.length === 0) return []
    const from = new Date(
      Math.min(...slots.map((slot) => slot.startAt.getTime()))
    )
    const to = new Date(Math.max(...slots.map((slot) => slot.endAt.getTime())))

    const [requests, events] = await Promise.all([
      this.db.meetingRequest.findMany({
        where: {
          organizationId,
          status: { in: ACTIVE_STATUSES },
          slots: { some: { startAt: { lt: to }, endAt: { gt: from } } },
          ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        },
        select: {
          id: true,
          slots: { select: { startAt: true, endAt: true } },
        },
        take: 100,
      }),
      this.db.calendarEvent.findMany({
        where: {
          organizationId,
          calendar: { kind: "team" },
          startAt: { lt: to },
          endAt: { gt: from },
        },
        select: { startAt: true, endAt: true },
        take: 500,
      }),
    ])

    return slots.map(
      (slot) =>
        requests.some((request) =>
          request.slots.some(
            (other) =>
              slot.startAt.getTime() < other.endAt.getTime() &&
              other.startAt.getTime() < slot.endAt.getTime()
          )
        ) ||
        events.some(
          (event) =>
            slot.startAt.getTime() < event.endAt.getTime() &&
            event.startAt.getTime() < slot.endAt.getTime()
        )
    )
  }

  listTeamEvents(organizationId: string, from: Date, to: Date) {
    return this.db.calendarEvent.findMany({
      where: {
        organizationId,
        calendar: { kind: "team" },
        startAt: { lt: to },
        endAt: { gt: from },
      },
      select: { id: true, title: true, startAt: true, endAt: true },
      take: 500,
    })
  }

  findCalendar(organizationId: string, id: string) {
    return this.db.calendar.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true },
    })
  }

  /** The shared team calendar meetings are booked on, created on demand. */
  async ensureTeamCalendar(organizationId: string, userId: string) {
    const existing = await this.db.calendar.findFirst({
      where: { organizationId, kind: "team" },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    })
    if (existing) return existing

    const created = await this.db.calendar.create({
      data: {
        organizationId,
        name: "Team meetings",
        color: "purple",
        kind: "team",
        members: { create: [{ userId }] },
      },
      select: { id: true, name: true },
    })
    return created
  }

  createEvent(data: {
    organizationId: string
    calendarId: string
    title: string
    description?: string
    startAt: Date
    endAt: Date
    location?: string
    meetingUrl?: string
    meetingPassword?: string
    createdBy: string
    attendees: { userId: string; response: string }[]
  }) {
    return this.db.calendarEvent.create({
      data: {
        organizationId: data.organizationId,
        calendarId: data.calendarId,
        title: data.title,
        description: data.description,
        startAt: data.startAt,
        endAt: data.endAt,
        allDay: false,
        location: data.location,
        meetingUrl: data.meetingUrl,
        meetingPassword: data.meetingPassword,
        color: "purple",
        reminderMinutes: 15,
        createdBy: data.createdBy,
        attendees: {
          create: data.attendees.map((attendee) => ({
            userId: attendee.userId,
            response: attendee.response,
          })),
        },
      },
      select: { id: true },
    })
  }

  /** Marks the chosen proposed slot as the confirmed one. */
  async selectSlot(requestId: string, slotId: string) {
    await this.db.$transaction([
      this.db.meetingSlot.updateMany({
        where: { requestId },
        data: { selected: false },
      }),
      this.db.meetingSlot.updateMany({
        where: { id: slotId, requestId },
        data: { selected: true },
      }),
    ])
  }

  /** Internal members that receive new meeting requests (owner/admins). */
  async listManagers(organizationId: string) {
    return this.db.member.findMany({
      where: { organizationId, clientId: null },
      select: { userId: true, role: true },
    })
  }

  /** Portal users of a client company, notified when a request is decided. */
  async listPortalUsers(organizationId: string, clientId: string) {
    return this.db.member.findMany({
      where: { organizationId, clientId },
      select: { userId: true },
    })
  }
}
