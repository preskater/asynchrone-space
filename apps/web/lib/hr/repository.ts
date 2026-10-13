import type { PrismaClient } from "@/lib/generated/prisma/client"

export class HrRepository {
  constructor(private readonly db: PrismaClient) {}

  listMembers(organizationId: string) {
    return this.db.member.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  }

  findSettings(organizationId: string) {
    return this.db.hrSettings.findUnique({ where: { organizationId } })
  }

  upsertSettings(
    organizationId: string,
    data: { defaultAllowanceDays: number; weeklyHourTarget: number }
  ) {
    return this.db.hrSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    })
  }

  listBalances(organizationId: string, year: number) {
    return this.db.timeOffBalance.findMany({
      where: { organizationId, year },
    })
  }

  upsertBalance(
    organizationId: string,
    userId: string,
    year: number,
    allowanceDays: number
  ) {
    return this.db.timeOffBalance.upsert({
      where: { organizationId_userId_year: { organizationId, userId, year } },
      create: { organizationId, userId, year, allowanceDays },
      update: { allowanceDays },
    })
  }

  /**
   * Requests that still matter: anything ending on/after `from`, plus every
   * pending request regardless of age (so nothing stays stuck unapproved).
   */
  listRequests(organizationId: string, options: { from?: Date } = {}) {
    return this.db.timeOffRequest.findMany({
      where: {
        organizationId,
        ...(options.from
          ? {
              OR: [
                { endDate: { gte: options.from } },
                { status: "pending" },
              ],
            }
          : {}),
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    })
  }

  findRequest(organizationId: string, id: string) {
    return this.db.timeOffRequest.findFirst({
      where: { id, organizationId },
    })
  }

  createRequest(data: {
    organizationId: string
    userId: string
    type: string
    startDate: Date
    endDate: Date
    days: number
    reason?: string
  }) {
    return this.db.timeOffRequest.create({ data })
  }

  updateRequest(
    id: string,
    data: {
      status?: string
      decidedBy?: string
      decidedAt?: Date
    }
  ) {
    return this.db.timeOffRequest.update({ where: { id }, data })
  }

  listLocations(organizationId: string, from: Date, to: Date) {
    return this.db.workLocationDay.findMany({
      where: { organizationId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    })
  }

  upsertLocation(data: {
    organizationId: string
    userId: string
    date: Date
    status: string
    note?: string
  }) {
    return this.db.workLocationDay.upsert({
      where: {
        organizationId_userId_date: {
          organizationId: data.organizationId,
          userId: data.userId,
          date: data.date,
        },
      },
      create: data,
      update: { status: data.status, note: data.note ?? null },
    })
  }

  clearLocation(organizationId: string, userId: string, date: Date) {
    return this.db.workLocationDay.deleteMany({
      where: { organizationId, userId, date },
    })
  }

  listEntries(organizationId: string, userId: string, from: Date, to: Date) {
    return this.db.timeEntry.findMany({
      where: { organizationId, userId, date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
    })
  }

  findEntry(organizationId: string, id: string) {
    return this.db.timeEntry.findFirst({ where: { id, organizationId } })
  }

  upsertEntry(data: {
    organizationId: string
    userId: string
    date: Date
    hours: number
    note?: string
  }) {
    return this.db.timeEntry.upsert({
      where: {
        organizationId_userId_date: {
          organizationId: data.organizationId,
          userId: data.userId,
          date: data.date,
        },
      },
      create: data,
      update: { hours: data.hours, note: data.note ?? null },
    })
  }

  deleteEntry(id: string) {
    return this.db.timeEntry.delete({ where: { id } })
  }
}
