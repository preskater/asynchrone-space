import {
  addDaysToKey,
  addMonthsToKey,
  isMonthKey,
  monthDateRange,
  monthKeyOf,
  parseDateKey,
  round2,
  startOfWeekKey,
  toDateKey,
} from "./date-utils"
import { buildAlerts } from "./alerts"
import { resolveHrAccess, type HrAccess } from "./access"
import { computeCapacityMonth, computeCapacityWeeks } from "./capacity"
import { toCsv, type CsvFile } from "./csv"
import type { RequestContext } from "@/lib/core/context"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/core/errors"
import { HrRepository } from "./repository"
import type {
  ActivityInput,
  AdjustBalanceInput,
  ClientInput,
  ClearAttendanceInput,
  CreateLeaveInput,
  DecideLeaveInput,
  ExportInput,
  ProjectHrInput,
  SetAllowanceInput,
  SetAttendanceInput,
  SetDayStatusInput,
  UpdateProfileInput,
  UpdateSalaryInput,
  UpdateSettingsInput,
} from "./schemas"
import {
  DAY_PERIODS,
  LEAVE_STATUS_TO_ATTENDANCE,
  TRACKED_LEAVE_TYPES,
  isAbsenceStatus,
  isWorkingStatus,
  type AttendanceEntryData,
  type AttendanceStatus,
  type AuditLogData,
  type BalanceType,
  type ClientData,
  type DayPeriod,
  type HrMemberData,
  type HrOverviewData,
  type HrProfileData,
  type HrSettingsData,
  type InternalActivityData,
  type LeaveAdjustmentData,
  type LeaveBalanceData,
  type LeaveRequestData,
  type LeaveType,
  type PayrollData,
  type ProjectOptionData,
  type SalaryProfileData,
  type SalaryType,
  type TrackingResult,
  type TrackingRow,
  type WorkLocationKind,
} from "./types"
import {
  halfDayHours,
  halfKeysBetween,
  sum,
} from "./utils"

const DEFAULT_SETTINGS: HrSettingsData = {
  defaultWeeklyHours: 35,
  defaultAllowanceDays: 25,
  lowBalanceThreshold: 5,
  pendingValidationDays: 3,
  defaultEmployeeRate: 22,
  defaultEmployerRate: 42,
}

const QUICK_LOCATION: Partial<Record<AttendanceStatus, WorkLocationKind>> = {
  on_site: "on_site",
  remote: "remote",
  business_trip: "traveling",
}

function requireTrack(access: HrAccess) {
  if (access.canTrack) return
  throw new ForbiddenError("Your role cannot update attendance.", {
    code: "role_cannot_modify_hr",
  })
}

function requireValidator(access: HrAccess) {
  if (access.isValidator) return
  throw new ForbiddenError("Your role cannot manage leave requests.", {
    code: "role_cannot_manage_hr",
  })
}

function requireAdmin(access: HrAccess) {
  if (access.isAdmin) return
  throw new ForbiddenError("Your role cannot manage HR settings.", {
    code: "role_cannot_manage_hr",
  })
}

const PERIOD_INDEX: Record<DayPeriod, number> = { morning: 0, afternoon: 1 }

type MemberRow = Awaited<ReturnType<HrRepository["listMembers"]>>[number]
type ProfileRow = Awaited<ReturnType<HrRepository["listProfiles"]>>[number]
type AttendanceRow = Awaited<ReturnType<HrRepository["listAttendance"]>>[number]
type LeaveRow = Awaited<ReturnType<HrRepository["listLeaveRequests"]>>[number]
type BalanceRow = Awaited<ReturnType<HrRepository["listBalances"]>>[number]
type AdjustmentRow = Awaited<ReturnType<HrRepository["listAdjustments"]>>[number]
type ClientRow = Awaited<ReturnType<HrRepository["listClients"]>>[number]
type ActivityRow = Awaited<ReturnType<HrRepository["listActivities"]>>[number]
type ProjectRow = Awaited<ReturnType<HrRepository["listProjects"]>>[number]
type AuditRow = Awaited<ReturnType<HrRepository["listAudit"]>>[number]
type AllocationRow = Awaited<
  ReturnType<HrRepository["listAllocationEntries"]>
>[number]
type SalaryRow = Awaited<ReturnType<HrRepository["listSalaryProfiles"]>>[number]

export class HrService {
  constructor(private readonly repo: HrRepository) {}

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  private mapProfile(
    profile: ProfileRow | undefined,
    settings: HrSettingsData
  ): HrProfileData {
    return {
      employmentType:
        (profile?.employmentType as HrProfileData["employmentType"]) ??
        "employee",
      contractType:
        (profile?.contractType as HrProfileData["contractType"]) ?? "cdi",
      weeklyHours: profile?.weeklyHours ?? settings.defaultWeeklyHours,
      managerId: profile?.managerId ?? undefined,
      isValidator: profile?.isValidator ?? false,
      isActive: profile?.isActive ?? true,
    }
  }

  private mapMember(
    row: MemberRow,
    profileByUser: Map<string, ProfileRow>,
    settings: HrSettingsData
  ): HrMemberData {
    return {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      avatarUrl: row.user.image ?? undefined,
      orgRole: row.role,
      profile: this.mapProfile(profileByUser.get(row.user.id), settings),
    }
  }

  private mapAttendance(
    row: AttendanceRow,
    maskOthers: boolean,
    viewerId: string
  ): AttendanceEntryData {
    const masked = maskOthers && row.userId !== viewerId
    return {
      id: row.id,
      userId: row.userId,
      date: toDateKey(row.date),
      period: row.period as DayPeriod,
      status: row.status as AttendanceStatus,
      location: (row.location as WorkLocationKind | null) ?? undefined,
      projectId: masked ? undefined : (row.projectId ?? undefined),
      internalActivityId: masked
        ? undefined
        : (row.internalActivityId ?? undefined),
      leaveRequestId: row.leaveRequestId ?? undefined,
      isBillable: masked ? false : row.isBillable,
      comment: masked ? undefined : (row.comment ?? undefined),
    }
  }

  private mapLeave(
    row: LeaveRow,
    nameById: Map<string, string>
  ): LeaveRequestData {
    return {
      id: row.id,
      userId: row.userId,
      userName: nameById.get(row.userId) ?? "—",
      type: row.type as LeaveType,
      status: row.status as LeaveRequestData["status"],
      startDate: toDateKey(row.startDate),
      endDate: toDateKey(row.endDate),
      startPeriod: row.startPeriod as DayPeriod,
      endPeriod: row.endPeriod as DayPeriod,
      halfDays: row.halfDays,
      comment: row.comment ?? undefined,
      validatorId: row.validatorId ?? undefined,
      validatorName: row.validatorId
        ? nameById.get(row.validatorId)
        : undefined,
      decisionDate: row.decisionDate?.toISOString(),
      decisionComment: row.decisionComment ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private mapClient(row: ClientRow): ClientData {
    return {
      id: row.id,
      name: row.name,
      contactEmail: row.contactEmail ?? undefined,
      isActive: row.isActive,
    }
  }

  private mapActivity(row: ActivityRow): InternalActivityData {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      kind: row.kind as InternalActivityData["kind"],
      isActive: row.isActive,
    }
  }

  private mapProject(row: ProjectRow): ProjectOptionData {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      clientId: row.clientId ?? undefined,
      clientName: row.client?.name ?? undefined,
      isBillable: row.isBillable,
      plannedHours: row.plannedHours ?? undefined,
      startDate: row.startDate ? toDateKey(row.startDate) : undefined,
      endDate: row.endDate ? toDateKey(row.endDate) : undefined,
    }
  }

  private mapAudit(row: AuditRow, nameById: Map<string, string>): AuditLogData {
    return {
      id: row.id,
      actorId: row.actorId,
      actorName: nameById.get(row.actorId) ?? "—",
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private async accessFor(ctx: RequestContext): Promise<HrAccess> {
    const profile = await this.repo.findProfile(ctx.organizationId, ctx.userId)
    return resolveHrAccess(ctx, profile?.isValidator ?? false)
  }

  private async loadMembers(organizationId: string): Promise<{
    members: HrMemberData[]
    nameById: Map<string, string>
    settings: HrSettingsData
  }> {
    const [memberRows, profileRows, settingsRow] = await Promise.all([
      this.repo.listMembers(organizationId),
      this.repo.listProfiles(organizationId),
      this.repo.findSettings(organizationId),
    ])
    const settings: HrSettingsData = settingsRow
      ? {
          defaultWeeklyHours: settingsRow.defaultWeeklyHours,
          defaultAllowanceDays: settingsRow.defaultAllowanceDays,
          lowBalanceThreshold: settingsRow.lowBalanceThreshold,
          pendingValidationDays: settingsRow.pendingValidationDays,
          defaultEmployeeRate: settingsRow.defaultEmployeeRate,
          defaultEmployerRate: settingsRow.defaultEmployerRate,
        }
      : DEFAULT_SETTINGS
    const profileByUser = new Map(profileRows.map((row) => [row.userId, row]))
    const members = memberRows.map((row) =>
      this.mapMember(row, profileByUser, settings)
    )
    return {
      members,
      nameById: new Map(members.map((member) => [member.id, member.name])),
      settings,
    }
  }

  // ---------------------------------------------------------------------------
  // Overview
  // ---------------------------------------------------------------------------

  async getOverview(ctx: RequestContext): Promise<HrOverviewData> {
    const todayKey = toDateKey(new Date())
    const year = Number(todayKey.slice(0, 4))
    const monthKey = todayKey.slice(0, 7)
    const rangeStart = monthDateRange(addMonthsToKey(monthKey, -1)).start
    const rangeEnd = monthDateRange(addMonthsToKey(monthKey, 2)).end

    const access = await this.accessFor(ctx)

    const [
      memberInfo,
      attendanceRows,
      leaveRows,
      balanceRows,
      adjustmentRows,
      clientRows,
      activityRows,
      projectRows,
      allocationRows,
      salaryRows,
      auditRows,
    ] = await Promise.all([
      this.loadMembers(ctx.organizationId),
      this.repo.listAttendance(
        ctx.organizationId,
        parseDateKey(rangeStart),
        parseDateKey(rangeEnd)
      ),
      this.repo.listLeaveRequests(ctx.organizationId, {
        from: parseDateKey(`${year - 1}-01-01`),
      }),
      this.repo.listBalances(ctx.organizationId, year),
      this.repo.listAdjustments(ctx.organizationId, year),
      this.repo.listClients(ctx.organizationId),
      this.repo.listActivities(ctx.organizationId),
      this.repo.listProjects(ctx.organizationId),
      // Project totals only need the current year; unbounded allocations made
      // the overview grow with every tracked half-day ever recorded.
      this.repo.listAllocationEntries(ctx.organizationId, {
        from: parseDateKey(`${year}-01-01`),
        to: parseDateKey(rangeEnd),
      }),
      access.isAdmin ? this.repo.listSalaryProfiles(ctx.organizationId) : [],
      access.isAdmin ? this.repo.listAudit(ctx.organizationId, 100) : [],
    ])

    const { members, nameById, settings } = memberInfo
    const myProfile =
      members.find((member) => member.id === ctx.userId)?.profile ??
      this.mapProfile(undefined, settings)

    const scopeMembers = access.canViewAll
      ? members
      : members.filter((member) => member.id === ctx.userId)

    const attendance = attendanceRows.map((row) =>
      this.mapAttendance(row, !access.canViewAll, ctx.userId)
    )
    const leaveRequests = leaveRows
      .filter((row) => access.canViewAll || row.userId === ctx.userId)
      .map((row) => this.mapLeave(row, nameById))
    const pendingApprovals = leaveRows
      .filter(
        (row) =>
          row.status === "pending" &&
          (access.canViewAll || row.userId === ctx.userId)
      )
      .map((row) => this.mapLeave(row, nameById))

    const balances = this.computeBalances({
      members: scopeMembers,
      balanceRows,
      adjustmentRows,
      leaveRows,
      settings,
      year,
      nameById,
    })
    const adjustments = adjustmentRows
      .filter((row) => access.canViewAll || row.userId === ctx.userId)
      .map((row) => this.mapAdjustment(row, nameById))

    const capacityWeeks = computeCapacityWeeks(
      scopeMembers,
      attendance,
      todayKey,
      5
    )
    const capacityMonth = computeCapacityMonth(scopeMembers, attendance, todayKey)

    const projectTotals = this.buildProjectTotals(
      allocationRows,
      members,
      projectRows
    )
    const alerts = buildAlerts({
      todayKey,
      members: scopeMembers,
      entries: attendance,
      currentWeekRows: capacityWeeks[0]?.rows ?? [],
      leaveRequests,
      balances,
      settings,
      projectTotals,
    })

    const payroll = access.isAdmin
      ? this.computePayroll(members, salaryRows, settings, attendance, monthKey)
      : null

    return {
      todayKey,
      year,
      currentUserId: ctx.userId,
      access: {
        isAdmin: access.isAdmin,
        isValidator: access.isValidator,
        canViewAll: access.canViewAll,
        canTrack: access.canTrack,
      },
      settings,
      members,
      myProfile,
      attendance,
      attendanceRange: { start: rangeStart, end: rangeEnd },
      leaveRequests,
      pendingApprovals,
      balances,
      adjustments,
      capacityWeeks,
      capacityMonth,
      alerts,
      payroll,
      clients: clientRows.map((row) => this.mapClient(row)),
      activities: activityRows.map((row) => this.mapActivity(row)),
      projects: projectRows.map((row) => this.mapProject(row)),
      audit: auditRows.map((row) => this.mapAudit(row, nameById)),
    }
  }

  private mapAdjustment(
    row: AdjustmentRow,
    nameById: Map<string, string>
  ): LeaveAdjustmentData {
    return {
      id: row.id,
      userId: row.userId,
      userName: nameById.get(row.userId) ?? "—",
      leaveType: row.leaveType as BalanceType,
      year: row.year,
      days: row.days,
      note: row.note ?? undefined,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private computeBalances(args: {
    members: HrMemberData[]
    balanceRows: BalanceRow[]
    adjustmentRows: AdjustmentRow[]
    leaveRows: LeaveRow[]
    settings: HrSettingsData
    year: number
    nameById: Map<string, string>
  }): LeaveBalanceData[] {
    const {
      members,
      balanceRows,
      adjustmentRows,
      leaveRows,
      settings,
      year,
      nameById,
    } = args

    const balanceKey = (userId: string, leaveType: string) =>
      `${userId}|${leaveType}`
    const byKey = new Map(
      balanceRows.map((row) => [balanceKey(row.userId, row.leaveType), row])
    )
    const adjustments = new Map<string, number>()
    for (const row of adjustmentRows) {
      const key = balanceKey(row.userId, row.leaveType)
      adjustments.set(key, (adjustments.get(key) ?? 0) + row.days)
    }

    const used = new Map<string, number>()
    const pending = new Map<string, number>()
    for (const row of leaveRows) {
      if (Number(toDateKey(row.startDate).slice(0, 4)) !== year) continue
      if (row.type === "sick") continue // illness does not consume a balance
      const key = balanceKey(row.userId, row.type)
      if (row.status === "approved") {
        used.set(key, (used.get(key) ?? 0) + row.halfDays)
      } else if (row.status === "pending") {
        pending.set(key, (pending.get(key) ?? 0) + row.halfDays)
      }
    }

    const result: LeaveBalanceData[] = []
    for (const member of members) {
      for (const leaveType of TRACKED_LEAVE_TYPES) {
        const key = balanceKey(member.id, leaveType)
        const balanceRow = byKey.get(key)
        const allowanceDays =
          balanceRow?.allowanceDays ??
          (leaveType === "paid_leave" ? settings.defaultAllowanceDays : 0)
        const adjustmentDays = round2(adjustments.get(key) ?? 0)
        const acquiredDays = round2(allowanceDays + adjustmentDays)
        const usedDays = round2((used.get(key) ?? 0) / 2)
        const pendingDays = round2((pending.get(key) ?? 0) / 2)
        result.push({
          userId: member.id,
          userName: nameById.get(member.id) ?? member.name,
          leaveType,
          year,
          allowanceDays,
          adjustmentDays,
          acquiredDays,
          usedDays,
          pendingDays,
          remainingDays: round2(acquiredDays - usedDays),
          expiresAt: balanceRow?.expiresAt?.toISOString(),
        })
      }
    }
    return result
  }

  private buildProjectTotals(
    allocationRows: AllocationRow[],
    members: HrMemberData[],
    projectRows: ProjectRow[]
  ) {
    const hoursByUser = new Map(
      members.map((member) => [
        member.id,
        halfDayHours(member.profile.weeklyHours),
      ])
    )
    const byProject = new Map<string, number>()
    for (const row of allocationRows) {
      if (!row.projectId) continue
      const hours = hoursByUser.get(row.userId) ?? halfDayHours(35)
      byProject.set(row.projectId, (byProject.get(row.projectId) ?? 0) + hours)
    }
    return projectRows
      .filter((project) => byProject.has(project.id))
      .map((project) => ({
        projectId: project.id,
        projectName: project.name,
        allocatedHours: round2(byProject.get(project.id) ?? 0),
        plannedHours: project.plannedHours ?? undefined,
      }))
  }

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------

  private attendanceSnapshot(row: {
    userId: string
    date: Date
    period: string
    status: string
    location: string | null
    projectId: string | null
    internalActivityId: string | null
    isBillable: boolean
    comment: string | null
  }) {
    return {
      userId: row.userId,
      date: toDateKey(row.date),
      period: row.period,
      status: row.status,
      location: row.location,
      projectId: row.projectId,
      internalActivityId: row.internalActivityId,
      isBillable: row.isBillable,
      comment: row.comment,
    }
  }

  async setAttendance(
    ctx: RequestContext,
    input: SetAttendanceInput
  ): Promise<AttendanceEntryData> {
    const access = await this.accessFor(ctx)
    return this.writeAttendance(ctx, input, access)
  }

  /**
   * Write one half-day using an access decision the caller already resolved.
   * `setDayStatus` uses this to update both periods with a single profile query.
   */
  private async writeAttendance(
    ctx: RequestContext,
    input: SetAttendanceInput,
    access: HrAccess
  ): Promise<AttendanceEntryData> {
    const targetUserId = input.userId ?? ctx.userId
    if (targetUserId === ctx.userId) {
      requireTrack(access)
    } else if (!access.isAdmin) {
      requireAdmin(access)
    }

    if (input.projectId != null && input.internalActivityId != null) {
      throw new ValidationError(
        "Choose either a project or an internal activity, not both."
      )
    }

    let projectId = input.projectId
    let activityId = input.internalActivityId
    let projectIsBillable: boolean | undefined
    if (projectId) {
      const project = await this.repo.findProject(ctx.organizationId, projectId)
      if (!project) throw new NotFoundError("Project")
      projectIsBillable = project.isBillable
    }
    if (activityId) {
      const activity = await this.repo.findActivity(
        ctx.organizationId,
        activityId
      )
      if (!activity) throw new NotFoundError("Internal activity")
    }

    const absence = isAbsenceStatus(input.status)
    if (absence) {
      projectId = null
      activityId = null
    }

    let isBillable: boolean | undefined
    if (absence || projectId === null) {
      isBillable = false
    } else if (projectId) {
      isBillable = projectIsBillable ?? false
    }

    const date = parseDateKey(input.date)
    const existing = await this.repo.findAttendance(
      ctx.organizationId,
      targetUserId,
      date,
      input.period
    )

    let row
    if (!existing) {
      row = await this.repo.createAttendance({
        organizationId: ctx.organizationId,
        userId: targetUserId,
        date,
        period: input.period,
        status: input.status,
        location: input.location ?? null,
        projectId: projectId ?? null,
        internalActivityId: activityId ?? null,
        leaveRequestId: null,
        isBillable: isBillable ?? false,
        comment: input.comment ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
    } else {
      row = await this.repo.updateAttendance(existing.id, {
        status: input.status,
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(projectId !== undefined ? { projectId } : {}),
        ...(activityId !== undefined ? { internalActivityId: activityId } : {}),
        ...(isBillable !== undefined ? { isBillable } : {}),
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
        updatedBy: ctx.userId,
      })
    }

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: existing ? "attendance.update" : "attendance.create",
        entityType: "attendance",
        entityId: row.id,
        before: existing ? this.attendanceSnapshot(existing) : undefined,
        after: this.attendanceSnapshot(row),
      },
    ])

    return this.mapAttendance(row, false, ctx.userId)
  }

  async clearAttendance(
    ctx: RequestContext,
    input: ClearAttendanceInput
  ): Promise<{ cleared: number }> {
    const access = await this.accessFor(ctx)
    const targetUserId = input.userId ?? ctx.userId
    if (targetUserId === ctx.userId) {
      requireTrack(access)
    } else if (!access.isAdmin) {
      requireAdmin(access)
    }

    const date = parseDateKey(input.date)
    const existingRows = (
      await Promise.all(
        input.periods.map((period) =>
          this.repo.findAttendance(ctx.organizationId, targetUserId, date, period)
        )
      )
    ).filter((row): row is AttendanceRow => Boolean(row))

    await this.repo.deleteAttendance(
      ctx.organizationId,
      targetUserId,
      date,
      input.periods
    )

    if (existingRows.length > 0) {
      await this.repo.createAudit([
        {
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          action: "attendance.clear",
          entityType: "attendance",
          entityId: `${targetUserId}:${input.date}`,
          before: existingRows.map((row) => this.attendanceSnapshot(row)),
        },
      ])
    }
    return { cleared: existingRows.length }
  }

  /** Quick action: set the same status for one or both halves of a day. */
  async setDayStatus(
    ctx: RequestContext,
    input: SetDayStatusInput
  ): Promise<{ updated: number }> {
    const access = await this.accessFor(ctx)
    const periods = input.periods ?? [...DAY_PERIODS]
    const location = QUICK_LOCATION[input.status] ?? null
    // One access lookup for both half-days, then parallel writes.
    await Promise.all(
      periods.map((period) =>
        this.writeAttendance(
          ctx,
          {
            userId: input.userId,
            date: input.date,
            period,
            status: input.status,
            location,
          },
          access
        )
      )
    )
    return { updated: periods.length }
  }

  // ---------------------------------------------------------------------------
  // Leave
  // ---------------------------------------------------------------------------

  private validateLeaveRange(
    startDate: string,
    endDate: string,
    startPeriod: DayPeriod,
    endPeriod: DayPeriod
  ) {
    if (endDate < startDate) {
      throw new ValidationError("The end date must be on or after the start date.")
    }
    if (
      startDate === endDate &&
      PERIOD_INDEX[startPeriod] > PERIOD_INDEX[endPeriod]
    ) {
      throw new ValidationError(
        "On a single day, the end half must not be before the start half."
      )
    }
  }

  async createLeave(
    ctx: RequestContext,
    input: CreateLeaveInput
  ): Promise<LeaveRequestData> {
    const access = await this.accessFor(ctx)
    const targetUserId = input.userId ?? ctx.userId
    if (targetUserId === ctx.userId) {
      requireTrack(access)
    } else if (!access.isAdmin) {
      requireAdmin(access)
    }

    this.validateLeaveRange(
      input.startDate,
      input.endDate,
      input.startPeriod,
      input.endPeriod
    )

    const keys = halfKeysBetween(
      input.startDate,
      input.startPeriod,
      input.endDate,
      input.endPeriod
    )
    if (keys.length === 0) {
      throw new ValidationError(
        "Pick a range that includes at least one working half-day."
      )
    }

    // Overlap detection: other pending/approved requests of the same user.
    const existing = await this.repo.listLeaveRequests(ctx.organizationId)
    const requested = new Set(keys)
    for (const row of existing) {
      if (row.userId !== targetUserId) continue
      if (row.status !== "pending" && row.status !== "approved") continue
      const rowKeys = halfKeysBetween(
        toDateKey(row.startDate),
        row.startPeriod as DayPeriod,
        toDateKey(row.endDate),
        row.endPeriod as DayPeriod
      )
      if (rowKeys.some((key) => requested.has(key))) {
        throw new ConflictError(
          "This request overlaps an existing leave request.",
          { code: "leave_overlapping" }
        )
      }
    }

    const row = await this.repo.createLeaveRequest({
      organizationId: ctx.organizationId,
      userId: targetUserId,
      type: input.type,
      startDate: parseDateKey(input.startDate),
      endDate: parseDateKey(input.endDate),
      startPeriod: input.startPeriod,
      endPeriod: input.endPeriod,
      // Half-day units throughout: balances divide by 2 for days.
      halfDays: keys.length,
      comment: input.comment,
    })

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "leave.create",
        entityType: "leaveRequest",
        entityId: row.id,
        after: this.leaveSnapshot(row),
      },
    ])

    const nameById = await this.namesById(ctx.organizationId)
    return this.mapLeave(row, nameById)
  }

  private leaveSnapshot(row: LeaveRow) {
    return {
      userId: row.userId,
      type: row.type,
      status: row.status,
      startDate: toDateKey(row.startDate),
      endDate: toDateKey(row.endDate),
      startPeriod: row.startPeriod,
      endPeriod: row.endPeriod,
      halfDays: row.halfDays,
    }
  }

  private async namesById(
    organizationId: string
  ): Promise<Map<string, string>> {
    const members = await this.repo.listMembers(organizationId)
    return new Map(members.map((row) => [row.user.id, row.user.name]))
  }

  async decideLeave(
    ctx: RequestContext,
    requestId: string,
    input: DecideLeaveInput
  ): Promise<LeaveRequestData> {
    const access = await this.accessFor(ctx)
    requireValidator(access)

    const row = await this.repo.findLeaveRequest(ctx.organizationId, requestId)
    if (!row) throw new NotFoundError("Leave request")

    if (row.userId === ctx.userId) {
      throw new ConflictError("You cannot decide on your own leave request.", {
        code: "leave_self_approval",
      })
    }
    if (row.status !== "pending") {
      throw new ConflictError("This request has already been decided.", {
        code: "leave_not_pending",
      })
    }

    if (input.decision === "approved") {
      const status = LEAVE_STATUS_TO_ATTENDANCE[row.type as LeaveType]
      const keys = halfKeysBetween(
        toDateKey(row.startDate),
        row.startPeriod as DayPeriod,
        toDateKey(row.endDate),
        row.endPeriod as DayPeriod
      )
      for (const key of keys) {
        const [dateKey, period] = key.split(":") as [string, DayPeriod]
        const date = parseDateKey(dateKey)
        const existing = await this.repo.findAttendance(
          ctx.organizationId,
          row.userId,
          date,
          period
        )
        if (existing) {
          await this.repo.updateAttendance(existing.id, {
            status,
            location: null,
            projectId: null,
            internalActivityId: null,
            leaveRequestId: row.id,
            isBillable: false,
            updatedBy: ctx.userId,
          })
        } else {
          await this.repo.createAttendance({
            organizationId: ctx.organizationId,
            userId: row.userId,
            date,
            period,
            status,
            leaveRequestId: row.id,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
        }
      }
    }

    const updated = await this.repo.updateLeaveRequest(requestId, {
      status: input.decision,
      validatorId: ctx.userId,
      decisionDate: new Date(),
      decisionComment: input.comment,
    })

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: `leave.${input.decision}`,
        entityType: "leaveRequest",
        entityId: requestId,
        before: this.leaveSnapshot(row),
        after: this.leaveSnapshot(updated),
      },
    ])

    return this.mapLeave(updated, await this.namesById(ctx.organizationId))
  }

  async cancelLeave(
    ctx: RequestContext,
    requestId: string
  ): Promise<LeaveRequestData> {
    const access = await this.accessFor(ctx)

    const row = await this.repo.findLeaveRequest(ctx.organizationId, requestId)
    if (!row) throw new NotFoundError("Leave request")

    if (row.userId !== ctx.userId) {
      requireAdmin(access)
    } else {
      requireTrack(access)
    }

    if (row.status !== "pending" && row.status !== "approved") {
      throw new ConflictError("This request can no longer be cancelled.", {
        code: "leave_not_pending",
      })
    }

    if (row.status === "approved") {
      await this.repo.deleteAttendanceByLeaveRequest(requestId)
    }

    const updated = await this.repo.updateLeaveRequest(requestId, {
      status: "cancelled",
    })

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "leave.cancel",
        entityType: "leaveRequest",
        entityId: requestId,
        before: this.leaveSnapshot(row),
        after: this.leaveSnapshot(updated),
      },
    ])

    return this.mapLeave(updated, await this.namesById(ctx.organizationId))
  }

  // ---------------------------------------------------------------------------
  // Balances, settings, profiles
  // ---------------------------------------------------------------------------

  async setAllowance(
    ctx: RequestContext,
    input: SetAllowanceInput
  ): Promise<{ userId: string; leaveType: BalanceType; year: number }> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    const row = await this.repo.upsertBalance(
      ctx.organizationId,
      input.userId,
      input.leaveType,
      input.year,
      {
        allowanceDays: input.allowanceDays,
        expiresAt: input.expiresAt ? parseDateKey(input.expiresAt) : null,
      }
    )

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "balance.set",
        entityType: "leaveBalance",
        entityId: row.id,
        after: { allowanceDays: row.allowanceDays, leaveType: row.leaveType },
      },
    ])

    return {
      userId: row.userId,
      leaveType: row.leaveType as BalanceType,
      year: row.year,
    }
  }

  async adjustBalance(
    ctx: RequestContext,
    input: AdjustBalanceInput
  ): Promise<LeaveAdjustmentData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    const row = await this.repo.createAdjustment({
      organizationId: ctx.organizationId,
      userId: input.userId,
      leaveType: input.leaveType,
      year: input.year,
      days: input.days,
      note: input.note,
      createdBy: ctx.userId,
    })

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "balance.adjust",
        entityType: "leaveAdjustment",
        entityId: row.id,
        after: {
          userId: row.userId,
          leaveType: row.leaveType,
          days: row.days,
        },
      },
    ])

    return this.mapAdjustment(row, await this.namesById(ctx.organizationId))
  }

  async updateSettings(
    ctx: RequestContext,
    input: UpdateSettingsInput
  ): Promise<HrSettingsData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    const row = await this.repo.upsertSettings(ctx.organizationId, input)

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "settings.update",
        entityType: "hrSettings",
        entityId: row.id,
        after: input,
      },
    ])

    return {
      defaultWeeklyHours: row.defaultWeeklyHours,
      defaultAllowanceDays: row.defaultAllowanceDays,
      lowBalanceThreshold: row.lowBalanceThreshold,
      pendingValidationDays: row.pendingValidationDays,
      defaultEmployeeRate: row.defaultEmployeeRate,
      defaultEmployerRate: row.defaultEmployerRate,
    }
  }

  async updateProfile(
    ctx: RequestContext,
    input: UpdateProfileInput
  ): Promise<HrProfileData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    const before = await this.repo.findProfile(ctx.organizationId, input.userId)
    const row = await this.repo.upsertProfile(
      ctx.organizationId,
      input.userId,
      {
        employmentType: input.employmentType,
        contractType: input.contractType,
        weeklyHours: input.weeklyHours,
        managerId: input.managerId ?? null,
        isValidator: input.isValidator,
        isActive: input.isActive,
      }
    )

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "profile.update",
        entityType: "hrProfile",
        entityId: row.id,
        before: before
          ? {
              weeklyHours: before.weeklyHours,
              isValidator: before.isValidator,
              isActive: before.isActive,
            }
          : undefined,
        after: {
          weeklyHours: row.weeklyHours,
          isValidator: row.isValidator,
          isActive: row.isActive,
        },
      },
    ])

    return this.mapProfile(row, DEFAULT_SETTINGS)
  }

  // ---------------------------------------------------------------------------
  // Payroll
  // ---------------------------------------------------------------------------

  /**
   * Build one payroll line per member for a month: worked hours come from
   * attendance entries with a working status, money columns from the salary
   * profile (or the organization defaults) and the contribution rates.
   */
  private computePayroll(
    members: HrMemberData[],
    salaryRows: SalaryRow[],
    settings: HrSettingsData,
    entries: AttendanceEntryData[],
    monthKey: string
  ): PayrollData {
    const salaryByUser = new Map(salaryRows.map((row) => [row.userId, row]))
    const rows = members.map((member) => {
      const salary = salaryByUser.get(member.id)
      const hourlyRate = salary?.hourlyRate ?? 0
      const employeeRate = salary?.employeeRate ?? settings.defaultEmployeeRate
      const employerRate = salary?.employerRate ?? settings.defaultEmployerRate
      const halfHours = halfDayHours(member.profile.weeklyHours)
      const workedHours = sum(
        entries
          .filter(
            (entry) =>
              entry.userId === member.id &&
              entry.date.slice(0, 7) === monthKey &&
              isWorkingStatus(entry.status)
          )
          .map(() => halfHours)
      )
      const grossPay = round2(workedHours * hourlyRate)
      const employeeContribution = round2((grossPay * employeeRate) / 100)
      const employerContribution = round2((grossPay * employerRate) / 100)
      return {
        userId: member.id,
        userName: member.name,
        salaryType: (salary?.salaryType ?? "full_time") as SalaryType,
        workedHours,
        hourlyRate,
        employeeRate,
        employerRate,
        grossPay,
        employeeContribution,
        employerContribution,
        netBeforeTax: round2(grossPay - employeeContribution),
        totalCost: round2(grossPay + employerContribution),
        hasSalaryProfile: Boolean(salary),
      }
    })
    return {
      monthKey,
      rows,
      totals: {
        workedHours: sum(rows.map((row) => row.workedHours)),
        grossPay: sum(rows.map((row) => row.grossPay)),
        employeeContribution: sum(rows.map((row) => row.employeeContribution)),
        employerContribution: sum(rows.map((row) => row.employerContribution)),
        netBeforeTax: sum(rows.map((row) => row.netBeforeTax)),
        totalCost: sum(rows.map((row) => row.totalCost)),
      },
    }
  }

  async getPayroll(ctx: RequestContext, monthKey: string): Promise<PayrollData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)
    if (!isMonthKey(monthKey)) {
      throw new ValidationError("Invalid payroll month.")
    }
    const range = monthDateRange(monthKey)
    const [memberInfo, salaryRows, attendanceRows] = await Promise.all([
      this.loadMembers(ctx.organizationId),
      this.repo.listSalaryProfiles(ctx.organizationId),
      this.repo.listAttendance(
        ctx.organizationId,
        parseDateKey(range.start),
        parseDateKey(range.end)
      ),
    ])
    const entries = attendanceRows.map((row) =>
      this.mapAttendance(row, false, ctx.userId)
    )
    return this.computePayroll(
      memberInfo.members,
      salaryRows,
      memberInfo.settings,
      entries,
      monthKey
    )
  }

  async updateSalary(
    ctx: RequestContext,
    input: UpdateSalaryInput
  ): Promise<SalaryProfileData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    const members = await this.repo.listMembers(ctx.organizationId)
    if (!members.some((member) => member.userId === input.userId)) {
      throw new NotFoundError("Member")
    }

    const before = await this.repo.findSalaryProfile(
      ctx.organizationId,
      input.userId
    )
    const row = await this.repo.upsertSalaryProfile(
      ctx.organizationId,
      input.userId,
      {
        salaryType: input.salaryType,
        hourlyRate: input.hourlyRate,
        employeeRate: input.employeeRate,
        employerRate: input.employerRate,
      }
    )

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "salary.update",
        entityType: "salaryProfile",
        entityId: row.id,
        before: before
          ? {
              salaryType: before.salaryType,
              hourlyRate: before.hourlyRate,
              employeeRate: before.employeeRate,
              employerRate: before.employerRate,
            }
          : undefined,
        after: {
          salaryType: row.salaryType,
          hourlyRate: row.hourlyRate,
          employeeRate: row.employeeRate,
          employerRate: row.employerRate,
        },
      },
    ])

    return {
      userId: row.userId,
      salaryType: row.salaryType as SalaryType,
      hourlyRate: row.hourlyRate,
      employeeRate: row.employeeRate,
      employerRate: row.employerRate,
    }
  }

  // ---------------------------------------------------------------------------
  // Clients, activities, projects
  // ---------------------------------------------------------------------------

  async saveClient(
    ctx: RequestContext,
    input: ClientInput
  ): Promise<ClientData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    let row
    if (input.id) {
      const existing = await this.repo.findClient(ctx.organizationId, input.id)
      if (!existing) throw new NotFoundError("Client")
      row = await this.repo.updateClient(input.id, {
        name: input.name,
        contactEmail: input.contactEmail ?? null,
        isActive: input.isActive,
      })
    } else {
      row = await this.repo.createClient({
        organizationId: ctx.organizationId,
        name: input.name,
        contactEmail: input.contactEmail ?? null,
        isActive: input.isActive,
      })
    }

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: input.id ? "client.update" : "client.create",
        entityType: "client",
        entityId: row.id,
        after: { name: row.name, isActive: row.isActive },
      },
    ])

    return this.mapClient(row)
  }

  async saveActivity(
    ctx: RequestContext,
    input: ActivityInput
  ): Promise<InternalActivityData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    let row
    if (input.id) {
      const existing = await this.repo.findActivity(
        ctx.organizationId,
        input.id
      )
      if (!existing) throw new NotFoundError("Internal activity")
      row = await this.repo.updateActivity(input.id, {
        name: input.name,
        description: input.description ?? null,
        kind: input.kind,
        isActive: input.isActive,
      })
    } else {
      row = await this.repo.createActivity({
        organizationId: ctx.organizationId,
        name: input.name,
        description: input.description ?? null,
        kind: input.kind,
        isActive: input.isActive,
      })
    }

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: input.id ? "activity.update" : "activity.create",
        entityType: "internalActivity",
        entityId: row.id,
        after: { name: row.name, kind: row.kind, isActive: row.isActive },
      },
    ])

    return this.mapActivity(row)
  }

  async updateProjectHr(
    ctx: RequestContext,
    input: ProjectHrInput
  ): Promise<ProjectOptionData> {
    const access = await this.accessFor(ctx)
    requireAdmin(access)

    const existing = await this.repo.findProject(
      ctx.organizationId,
      input.projectId
    )
    if (!existing) throw new NotFoundError("Project")

    if (input.clientId) {
      const client = await this.repo.findClient(ctx.organizationId, input.clientId)
      if (!client) throw new NotFoundError("Client")
    }

    await this.repo.updateProject(input.projectId, {
      clientId: input.clientId ?? null,
      plannedHours: input.plannedHours ?? null,
      isBillable: input.isBillable,
      startDate: input.startDate ? parseDateKey(input.startDate) : null,
      endDate: input.endDate ? parseDateKey(input.endDate) : null,
    })

    const row = await this.repo.findProject(ctx.organizationId, input.projectId)
    // Re-load with client include for the mapped shape.
    const projects = await this.repo.listProjects(ctx.organizationId)
    const full = projects.find((project) => project.id === input.projectId) ?? row
    if (!full) throw new NotFoundError("Project")

    await this.repo.createAudit([
      {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "project.update",
        entityType: "project",
        entityId: input.projectId,
        before: {
          plannedHours: existing.plannedHours,
          isBillable: existing.isBillable,
        },
        after: {
          plannedHours: input.plannedHours ?? null,
          isBillable: input.isBillable,
        },
      },
    ])

    return this.mapProject(full as ProjectRow)
  }

  // ---------------------------------------------------------------------------
  // Calendar range fetch & tracking
  // ---------------------------------------------------------------------------

  async fetchAttendance(
    ctx: RequestContext,
    fromKey: string,
    toKey: string
  ): Promise<{ start: string; end: string; entries: AttendanceEntryData[] }> {
    const access = await this.accessFor(ctx)
    const rows = await this.repo.listAttendance(
      ctx.organizationId,
      parseDateKey(fromKey),
      parseDateKey(toKey)
    )
    return {
      start: fromKey,
      end: toKey,
      entries: rows.map((row) =>
        this.mapAttendance(row, !access.canViewAll, ctx.userId)
      ),
    }
  }

  async fetchTracking(
    ctx: RequestContext,
    fromKey: string,
    toKey: string
  ): Promise<TrackingResult> {
    const access = await this.accessFor(ctx)
    const [rows, memberInfo, clientRows, projectRows, activityRows] =
      await Promise.all([
        this.repo.listAllocationEntries(ctx.organizationId, {
          from: parseDateKey(fromKey),
          to: parseDateKey(toKey),
        }),
        this.loadMembers(ctx.organizationId),
        this.repo.listClients(ctx.organizationId),
        this.repo.listProjects(ctx.organizationId),
        this.repo.listActivities(ctx.organizationId),
      ])

    const { members, nameById } = memberInfo
    const memberById = new Map(members.map((member) => [member.id, member]))
    const clientById = new Map(
      clientRows.map((client) => [client.id, client.name])
    )
    const projectById = new Map(
      projectRows.map((project) => [project.id, project])
    )
    const activityById = new Map(
      activityRows.map((activity) => [activity.id, activity])
    )

    const scoped = access.canViewAll
      ? rows
      : rows.filter((row) => row.userId === ctx.userId)

    type Bucket = {
      id: string
      label: string
      sublabel?: string
      billable: number
      nonBillable: number
      internal: number
    }
    const byUser = new Map<string, Bucket>()
    const byProject = new Map<string, Bucket>()
    const byClient = new Map<string, Bucket>()

    const add = (map: Map<string, Bucket>, bucket: Bucket, hours: number, kind: "billable" | "nonBillable" | "internal") => {
      bucket[kind] = round2(bucket[kind] + hours)
      map.set(bucket.id, bucket)
    }

    for (const row of scoped) {
      const member = memberById.get(row.userId)
      const hours = halfDayHours(member?.profile.weeklyHours ?? 35)
      const project = row.projectId ? projectById.get(row.projectId) : undefined
      const activity = row.internalActivityId
        ? activityById.get(row.internalActivityId)
        : undefined

      let kind: "billable" | "nonBillable" | "internal"
      if (project) {
        kind = project.isBillable ? "billable" : "nonBillable"
      } else if (activity) {
        kind = activity.kind === "internal" ? "internal" : "nonBillable"
      } else {
        continue
      }

      const userBucket =
        byUser.get(row.userId) ??
        ({
          id: row.userId,
          label: member?.name ?? nameById.get(row.userId) ?? "—",
          billable: 0,
          nonBillable: 0,
          internal: 0,
        } satisfies Bucket)
      add(byUser, userBucket, hours, kind)

      if (project) {
        const key = `${row.userId}|${project.id}`
        const bucket =
          byProject.get(key) ??
          ({
            id: key,
            label: project.name,
            sublabel: member?.name,
            billable: 0,
            nonBillable: 0,
            internal: 0,
          } satisfies Bucket)
        add(byProject, bucket, hours, kind)

        const clientName = project.clientId
          ? clientById.get(project.clientId)
          : undefined
        if (clientName) {
          const clientKey = `${row.userId}|${project.clientId}`
          const clientBucket =
            byClient.get(clientKey) ??
            ({
              id: clientKey,
              label: clientName,
              sublabel: member?.name,
              billable: 0,
              nonBillable: 0,
              internal: 0,
            } satisfies Bucket)
          add(byClient, clientBucket, hours, kind)
        }
      }
    }

    const toRows = (map: Map<string, Bucket>): TrackingRow[] =>
      [...map.values()]
        .map((bucket) => ({
          id: bucket.id,
          label: bucket.label,
          sublabel: bucket.sublabel,
          billableHours: bucket.billable,
          nonBillableHours: bucket.nonBillable,
          internalHours: bucket.internal,
          totalHours: round2(
            bucket.billable + bucket.nonBillable + bucket.internal
          ),
        }))
        .sort((a, b) => b.totalHours - a.totalHours)

    const rowsByUser = toRows(byUser)
    return {
      rowsByUser,
      rowsByProject: toRows(byProject),
      rowsByClient: toRows(byClient),
      totals: {
        billableHours: sum(rowsByUser.map((row) => row.billableHours)),
        nonBillableHours: sum(rowsByUser.map((row) => row.nonBillableHours)),
        internalHours: sum(rowsByUser.map((row) => row.internalHours)),
        totalHours: sum(rowsByUser.map((row) => row.totalHours)),
      },
    }
  }

  // ---------------------------------------------------------------------------
  // CSV exports
  // ---------------------------------------------------------------------------

  async exportCsv(ctx: RequestContext, input: ExportInput): Promise<CsvFile> {
    const access = await this.accessFor(ctx)
    const todayKey = toDateKey(new Date())
    const monthRange = monthDateRange(monthKeyOf(todayKey))

    if (input.report === "audit" && !access.isAdmin) {
      requireAdmin(access)
    }

    switch (input.report) {
      case "attendance":
        return this.exportAttendance(ctx, access, input, monthRange)
      case "leave":
        return this.exportLeave(ctx, access, todayKey)
      case "project-time":
        return this.exportTime(ctx, access, todayKey, "project")
      case "client-time":
        return this.exportTime(ctx, access, todayKey, "client")
      case "capacity":
        return this.exportCapacity(ctx, access, todayKey)
      case "payroll":
        return this.exportPayroll(ctx, access, input.month ?? monthKeyOf(todayKey))
      case "audit":
        return this.exportAudit(ctx)
      default:
        throw new ValidationError("Unknown report.")
    }
  }

  private async exportAttendance(
    ctx: RequestContext,
    access: HrAccess,
    input: ExportInput,
    defaultRange: { start: string; end: string }
  ): Promise<CsvFile> {
    const range =
      input.from && input.to
        ? { start: input.from, end: input.to }
        : defaultRange
    const [rows, memberInfo, clientRows, activityRows, projectRows] =
      await Promise.all([
        this.repo.listAttendance(
          ctx.organizationId,
          parseDateKey(range.start),
          parseDateKey(range.end)
        ),
        this.loadMembers(ctx.organizationId),
        this.repo.listClients(ctx.organizationId),
        this.repo.listActivities(ctx.organizationId),
        this.repo.listProjects(ctx.organizationId),
      ])
    const clientById = new Map(clientRows.map((row) => [row.id, row.name]))
    const activityById = new Map(activityRows.map((row) => [row.id, row.name]))
    const projectById = new Map(projectRows.map((row) => [row.id, row]))

    const csvRows: (string | number)[][] = [
      [
        "Date",
        "User",
        "Period",
        "Status",
        "Location",
        "Project",
        "Client",
        "Internal activity",
        "Billable",
        "Comment",
      ],
    ]
    for (const row of rows) {
      if (!access.canViewAll && row.userId !== ctx.userId) continue
      const project = row.projectId ? projectById.get(row.projectId) : undefined
      csvRows.push([
        toDateKey(row.date),
        memberInfo.nameById.get(row.userId) ?? row.userId,
        row.period,
        row.status,
        row.location ?? "",
        project?.name ?? "",
        project?.clientId ? (clientById.get(project.clientId) ?? "") : "",
        row.internalActivityId ? (activityById.get(row.internalActivityId) ?? "") : "",
        row.isBillable ? "yes" : "no",
        row.comment ?? "",
      ])
    }
    return {
      filename: `presk-attendance-${range.start}-${range.end}.csv`,
      content: toCsv(csvRows),
    }
  }

  private async exportLeave(
    ctx: RequestContext,
    access: HrAccess,
    todayKey: string
  ): Promise<CsvFile> {
    const [rows, nameById] = await Promise.all([
      this.repo.listLeaveRequests(ctx.organizationId),
      this.namesById(ctx.organizationId),
    ])
    const csvRows: (string | number)[][] = [
      [
        "User",
        "Type",
        "Status",
        "Start",
        "Start half",
        "End",
        "End half",
        "Half-days",
        "Comment",
        "Validator",
        "Decision date",
        "Decision comment",
      ],
    ]
    for (const row of rows) {
      if (!access.canViewAll && row.userId !== ctx.userId) continue
      csvRows.push([
        nameById.get(row.userId) ?? row.userId,
        row.type,
        row.status,
        toDateKey(row.startDate),
        row.startPeriod,
        toDateKey(row.endDate),
        row.endPeriod,
        row.halfDays,
        row.comment ?? "",
        row.validatorId ? (nameById.get(row.validatorId) ?? "") : "",
        row.decisionDate ? toDateKey(row.decisionDate) : "",
        row.decisionComment ?? "",
      ])
    }
    return {
      filename: `presk-leave-${todayKey}.csv`,
      content: toCsv(csvRows),
    }
  }

  private async exportTime(
    ctx: RequestContext,
    access: HrAccess,
    todayKey: string,
    group: "project" | "client"
  ): Promise<CsvFile> {
    const weekStart = startOfWeekKey(todayKey)
    const weekEnd = addDaysToKey(weekStart, 6)
    const monthRange = monthDateRange(monthKeyOf(todayKey))

    const [rows, memberInfo, projectRows, clientRows] = await Promise.all([
      this.repo.listAllocationEntries(ctx.organizationId),
      this.loadMembers(ctx.organizationId),
      this.repo.listProjects(ctx.organizationId),
      this.repo.listClients(ctx.organizationId),
    ])
    const memberById = new Map(memberInfo.members.map((m) => [m.id, m]))
    const projectById = new Map(projectRows.map((row) => [row.id, row]))
    const clientById = new Map(clientRows.map((row) => [row.id, row.name]))

    type Bucket = { week: number; month: number; total: number }
    const buckets = new Map<string, Bucket>()
    for (const row of rows) {
      if (!access.canViewAll && row.userId !== ctx.userId) continue
      const user = memberById.get(row.userId)
      const hours = halfDayHours(user?.profile.weeklyHours ?? 35)
      const dateKey = toDateKey(row.date)
      const project = row.projectId ? projectById.get(row.projectId) : undefined
      const label =
        group === "project"
          ? (project?.name ?? "—")
          : project?.clientId
            ? (clientById.get(project.clientId) ?? "—")
            : "— (no client)"
      const key = `${row.userId}|${label}`
      const bucket = buckets.get(key) ?? { week: 0, month: 0, total: 0 }
      bucket.total = round2(bucket.total + hours)
      if (dateKey >= weekStart && dateKey <= weekEnd) {
        bucket.week = round2(bucket.week + hours)
      }
      if (dateKey >= monthRange.start && dateKey <= monthRange.end) {
        bucket.month = round2(bucket.month + hours)
      }
      buckets.set(key, bucket)
    }

    const header =
      group === "project"
        ? ["User", "Project", "Hours this week", "Hours this month", "Hours since start"]
        : ["User", "Client", "Hours this week", "Hours this month", "Hours since start"]
    const csvRows: (string | number)[][] = [header]
    for (const [key, bucket] of buckets) {
      const [userId = "", label = ""] = key.split("|")
      csvRows.push([
        memberById.get(userId)?.name ?? userId,
        label,
        bucket.week,
        bucket.month,
        bucket.total,
      ])
    }
    return {
      filename: `presk-${group}-time-${todayKey}.csv`,
      content: toCsv(csvRows),
    }
  }

  private async exportCapacity(
    ctx: RequestContext,
    access: HrAccess,
    todayKey: string
  ): Promise<CsvFile> {
    const memberInfo = await this.loadMembers(ctx.organizationId)
    const scopeMembers = access.canViewAll
      ? memberInfo.members
      : memberInfo.members.filter((member) => member.id === ctx.userId)

    const rangeStart = startOfWeekKey(todayKey)
    const rangeEnd = addDaysToKey(rangeStart, 5 * 7 - 1)
    const rows = await this.repo.listAttendance(
      ctx.organizationId,
      parseDateKey(rangeStart),
      parseDateKey(rangeEnd)
    )
    const entries = rows.map((row) => this.mapAttendance(row, false, ctx.userId))
    const weeks = computeCapacityWeeks(scopeMembers, entries, todayKey, 5)

    const csvRows: (string | number)[][] = [
      ["Week", "User", "Weekly hours", "Available", "Allocated", "Remaining"],
    ]
    for (const week of weeks) {
      for (const row of week.rows) {
        csvRows.push([
          week.weekStart,
          row.userName,
          row.weeklyHours,
          row.availableHours,
          row.allocatedHours,
          row.remainingHours,
        ])
      }
    }
    return {
      filename: `presk-capacity-${todayKey}.csv`,
      content: toCsv(csvRows),
    }
  }

  private async exportPayroll(
    ctx: RequestContext,
    access: HrAccess,
    monthKey: string
  ): Promise<CsvFile> {
    requireAdmin(access)
    const payroll = await this.getPayroll(ctx, monthKey)
    const csvRows: (string | number)[][] = [
      [
        "Worker",
        "Type",
        "Worked hours",
        "Hourly wage",
        "Gross total",
        "Employee contributions",
        "Employer contributions",
        "Net before tax",
        "Total cost",
      ],
    ]
    for (const row of payroll.rows) {
      csvRows.push([
        row.userName,
        row.salaryType,
        row.workedHours,
        row.hourlyRate,
        row.grossPay,
        row.employeeContribution,
        row.employerContribution,
        row.netBeforeTax,
        row.totalCost,
      ])
    }
    csvRows.push([
      "Total",
      "",
      payroll.totals.workedHours,
      "",
      payroll.totals.grossPay,
      payroll.totals.employeeContribution,
      payroll.totals.employerContribution,
      payroll.totals.netBeforeTax,
      payroll.totals.totalCost,
    ])
    return {
      filename: `presk-payroll-${monthKey}.csv`,
      content: toCsv(csvRows),
    }
  }

  private async exportAudit(ctx: RequestContext): Promise<CsvFile> {
    const [rows, nameById] = await Promise.all([
      this.repo.listAudit(ctx.organizationId, 500),
      this.namesById(ctx.organizationId),
    ])
    const csvRows: (string | number)[][] = [
      ["Date", "Actor", "Action", "Entity type", "Entity id"],
    ]
    for (const row of rows) {
      csvRows.push([
        row.createdAt.toISOString(),
        nameById.get(row.actorId) ?? row.actorId,
        row.action,
        row.entityType,
        row.entityId,
      ])
    }
    return {
      filename: `presk-audit-${toDateKey(new Date())}.csv`,
      content: toCsv(csvRows),
    }
  }
}
