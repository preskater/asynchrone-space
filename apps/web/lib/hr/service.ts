import type { RequestContext } from "@/lib/core/context"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/core/errors"
import { roleRank } from "@/lib/organization/roles"

import {
  addDaysToKey,
  addMonthsToKey,
  businessDaysInYear,
  countBusinessDays,
  monthDateRange,
  parseDateKey,
  round2,
  toDateKey,
} from "./date-utils"
import { HrRepository } from "./repository"
import type {
  CreateTimeOffRequestInput,
  DecideTimeOffRequestInput,
  LogTimeEntryInput,
  SetTimeOffAllowanceInput,
  SetWorkLocationInput,
  UpdateHrSettingsInput,
} from "./schemas"
import type {
  HrMember,
  HrMonthLocations,
  HrOverviewData,
  HrSettingsData,
  LeaveStatus,
  LeaveType,
  TimeEntryData,
  TimeOffBalanceData,
  TimeOffRequestData,
  WorkLocation,
  WorkLocationDayData,
} from "./types"

const DEFAULT_SETTINGS: HrSettingsData = {
  defaultAllowanceDays: 25,
  weeklyHourTarget: 35,
}

/** Presence/locations are preloaded for the previous, current and next month. */
const LOCATION_WINDOW_MONTHS = [-1, 0, 1]

/** How many days of personal time entries are preloaded. */
const ENTRY_WINDOW_DAYS = 60

function requireTrack(ctx: RequestContext) {
  if (roleRank(ctx.role) >= 2) return
  throw new ForbiddenError("Your role cannot update HR data.", {
    code: "role_cannot_modify_hr",
  })
}

function requireManager(ctx: RequestContext) {
  if (roleRank(ctx.role) >= 3) return
  throw new ForbiddenError("Your role cannot manage HR settings or approvals.", {
    code: "role_cannot_manage_hr",
  })
}

type MemberRow = Awaited<ReturnType<HrRepository["listMembers"]>>[number]
type RequestRow = Awaited<ReturnType<HrRepository["listRequests"]>>[number]
type LocationRow = Awaited<ReturnType<HrRepository["listLocations"]>>[number]
type EntryRow = Awaited<ReturnType<HrRepository["listEntries"]>>[number]

export class HrService {
  constructor(private readonly repo: HrRepository) {}

  private mapMember(row: MemberRow): HrMember {
    return {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      avatarUrl: row.user.image ?? undefined,
      role: row.role,
    }
  }

  private mapRequest(
    row: RequestRow,
    nameById: Map<string, string>
  ): TimeOffRequestData {
    return {
      id: row.id,
      userId: row.userId,
      userName: nameById.get(row.userId) ?? "—",
      type: row.type as LeaveType,
      status: row.status as LeaveStatus,
      startDate: toDateKey(row.startDate),
      endDate: toDateKey(row.endDate),
      days: row.days,
      reason: row.reason ?? undefined,
      decidedBy: row.decidedBy ?? undefined,
      decidedAt: row.decidedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }
  }

  private mapLocation(row: LocationRow): WorkLocationDayData {
    return {
      userId: row.userId,
      date: toDateKey(row.date),
      status: row.status as WorkLocation,
      note: row.note ?? undefined,
    }
  }

  private mapEntry(row: EntryRow): TimeEntryData {
    return {
      id: row.id,
      userId: row.userId,
      date: toDateKey(row.date),
      hours: row.hours,
      note: row.note ?? undefined,
    }
  }

  private async resolveNames(
    organizationId: string
  ): Promise<Map<string, string>> {
    const members = await this.repo.listMembers(organizationId)
    return new Map(members.map((member) => [member.user.id, member.user.name]))
  }

  async overview(ctx: RequestContext): Promise<HrOverviewData> {
    const todayKey = toDateKey(new Date())
    const year = Number(todayKey.slice(0, 4))
    const monthKey = todayKey.slice(0, 7)
    const windowMonths = LOCATION_WINDOW_MONTHS.map((offset) =>
      addMonthsToKey(monthKey, offset)
    )
    const windowStart = monthDateRange(windowMonths[0]!).start
    const windowEnd = monthDateRange(windowMonths[windowMonths.length - 1]!)
      .end

    const canTrack = roleRank(ctx.role) >= 2
    const canManage = roleRank(ctx.role) >= 3

    const [members, settingsRow, balanceRows, requestRows, locationRows, entryRows] =
      await Promise.all([
        this.repo.listMembers(ctx.organizationId),
        this.repo.findSettings(ctx.organizationId),
        this.repo.listBalances(ctx.organizationId, year),
        this.repo.listRequests(ctx.organizationId, {
          from: parseDateKey(`${year - 1}-01-01`),
        }),
        this.repo.listLocations(
          ctx.organizationId,
          parseDateKey(windowStart),
          parseDateKey(windowEnd)
        ),
        this.repo.listEntries(
          ctx.organizationId,
          ctx.userId,
          parseDateKey(addDaysToKey(todayKey, -(ENTRY_WINDOW_DAYS - 1))),
          parseDateKey(todayKey)
        ),
      ])

    const settings: HrSettingsData = settingsRow
      ? {
          defaultAllowanceDays: settingsRow.defaultAllowanceDays,
          weeklyHourTarget: settingsRow.weeklyHourTarget,
        }
      : DEFAULT_SETTINGS

    const nameById = new Map(
      members.map((member) => [member.user.id, member.user.name])
    )
    const balanceByUser = new Map(balanceRows.map((row) => [row.userId, row]))

    const computeBalance = (
      userId: string,
      userName: string
    ): TimeOffBalanceData => {
      const custom = balanceByUser.get(userId)
      const allowanceDays = custom?.allowanceDays ?? settings.defaultAllowanceDays
      let usedDays = 0
      let pendingDays = 0
      for (const request of requestRows) {
        if (request.userId !== userId) continue
        const start = toDateKey(request.startDate)
        const end = toDateKey(request.endDate)
        if (request.status === "approved") {
          usedDays += businessDaysInYear(start, end, year)
        } else if (request.status === "pending") {
          pendingDays += businessDaysInYear(start, end, year)
        }
      }
      return {
        userId,
        userName,
        year,
        allowanceDays,
        usedDays: round2(usedDays),
        pendingDays: round2(pendingDays),
        availableDays: round2(allowanceDays - usedDays),
        configured: Boolean(custom),
      }
    }

    const self = members.find((member) => member.user.id === ctx.userId)
    const balance = computeBalance(
      ctx.userId,
      self?.user.name ?? ctx.userName
    )
    const teamBalances = canManage
      ? members.map((member) =>
          computeBalance(member.user.id, member.user.name)
        )
      : null

    const myRequests = requestRows
      .filter((request) => request.userId === ctx.userId)
      .map((request) => this.mapRequest(request, nameById))

    const allRequests = canManage
      ? requestRows.map((request) => this.mapRequest(request, nameById))
      : null

    const windowStartDate = parseDateKey(windowStart)
    const windowEndDate = parseDateKey(windowEnd)
    const teamLeave = requestRows
      .filter(
        (request) =>
          request.status === "approved" &&
          request.startDate <= windowEndDate &&
          request.endDate >= windowStartDate
      )
      .map((request) => {
        const mapped = this.mapRequest(request, nameById)
        // Reasons are private; only the requester and managers see them.
        if (!canManage && request.userId !== ctx.userId) {
          mapped.reason = undefined
        }
        return mapped
      })

    return {
      members: members.map((member) => this.mapMember(member)),
      currentUserId: ctx.userId,
      canTrack,
      canManage,
      settings,
      year,
      todayKey,
      balance,
      teamBalances,
      myRequests,
      allRequests,
      teamLeave,
      entries: entryRows.map((entry) => this.mapEntry(entry)),
      locations: locationRows.map((location) => this.mapLocation(location)),
      locationMonths: windowMonths,
    }
  }

  async listLocations(
    ctx: RequestContext,
    monthKey: string
  ): Promise<HrMonthLocations> {
    const { start, end } = monthDateRange(monthKey)
    const rows = await this.repo.listLocations(
      ctx.organizationId,
      parseDateKey(start),
      parseDateKey(end)
    )
    return {
      month: monthKey,
      days: rows.map((row) => this.mapLocation(row)),
    }
  }

  async setWorkLocation(
    ctx: RequestContext,
    input: SetWorkLocationInput
  ): Promise<WorkLocationDayData | null> {
    requireTrack(ctx)
    const date = parseDateKey(input.date)

    if (!input.status) {
      await this.repo.clearLocation(ctx.organizationId, ctx.userId, date)
      return null
    }

    const row = await this.repo.upsertLocation({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      date,
      status: input.status,
      note: input.note,
    })
    return this.mapLocation(row)
  }

  async createTimeOffRequest(
    ctx: RequestContext,
    input: CreateTimeOffRequestInput
  ): Promise<TimeOffRequestData> {
    requireTrack(ctx)
    const days = countBusinessDays(input.startDate, input.endDate)
    if (days <= 0) {
      throw new ValidationError(
        "Pick a range that includes at least one working day."
      )
    }

    const row = await this.repo.createRequest({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      type: input.type,
      startDate: parseDateKey(input.startDate),
      endDate: parseDateKey(input.endDate),
      days,
      reason: input.reason,
    })
    return this.mapRequest(row, await this.resolveNames(ctx.organizationId))
  }

  async cancelTimeOffRequest(
    ctx: RequestContext,
    requestId: string
  ): Promise<TimeOffRequestData> {
    const row = await this.repo.findRequest(ctx.organizationId, requestId)
    if (!row) throw new NotFoundError("Time-off request")

    if (row.userId !== ctx.userId) requireManager(ctx)

    if (row.status !== "pending" && row.status !== "approved") {
      throw new ConflictError("This request can no longer be cancelled.", {
        code: "time_off_not_pending",
      })
    }

    const updated = await this.repo.updateRequest(requestId, {
      status: "cancelled",
    })
    return this.mapRequest(updated, await this.resolveNames(ctx.organizationId))
  }

  async decideTimeOffRequest(
    ctx: RequestContext,
    requestId: string,
    input: DecideTimeOffRequestInput
  ): Promise<TimeOffRequestData> {
    requireManager(ctx)

    const row = await this.repo.findRequest(ctx.organizationId, requestId)
    if (!row) throw new NotFoundError("Time-off request")

    if (row.status !== "pending") {
      throw new ConflictError("This request has already been decided.", {
        code: "time_off_not_pending",
      })
    }

    const updated = await this.repo.updateRequest(requestId, {
      status: input.decision,
      decidedBy: ctx.userId,
      decidedAt: new Date(),
    })
    return this.mapRequest(updated, await this.resolveNames(ctx.organizationId))
  }

  async setTimeOffAllowance(
    ctx: RequestContext,
    input: SetTimeOffAllowanceInput
  ): Promise<{ userId: string; year: number; allowanceDays: number }> {
    requireManager(ctx)
    const balance = await this.repo.upsertBalance(
      ctx.organizationId,
      input.userId,
      input.year,
      input.allowanceDays
    )
    return {
      userId: balance.userId,
      year: balance.year,
      allowanceDays: balance.allowanceDays,
    }
  }

  async updateSettings(
    ctx: RequestContext,
    input: UpdateHrSettingsInput
  ): Promise<HrSettingsData> {
    requireManager(ctx)
    const row = await this.repo.upsertSettings(ctx.organizationId, input)
    return {
      defaultAllowanceDays: row.defaultAllowanceDays,
      weeklyHourTarget: row.weeklyHourTarget,
    }
  }

  async logTimeEntry(
    ctx: RequestContext,
    input: LogTimeEntryInput
  ): Promise<TimeEntryData> {
    requireTrack(ctx)
    const row = await this.repo.upsertEntry({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      date: parseDateKey(input.date),
      hours: input.hours,
      note: input.note,
    })
    return this.mapEntry(row)
  }

  async deleteTimeEntry(
    ctx: RequestContext,
    entryId: string
  ): Promise<{ id: string }> {
    requireTrack(ctx)
    const row = await this.repo.findEntry(ctx.organizationId, entryId)
    if (!row) throw new NotFoundError("Time entry")
    if (row.userId !== ctx.userId) {
      throw new ForbiddenError("You can only delete your own time entries.", {
        code: "role_cannot_modify_hr",
      })
    }
    await this.repo.deleteEntry(entryId)
    return { id: entryId }
  }
}
