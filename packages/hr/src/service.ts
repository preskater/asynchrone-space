import type { RequestContext } from "@workspace/core"
import type { CsvFile } from "./csv"
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
import type {
  AttendanceEntryData,
  BalanceType,
  ClientData,
  HrOverviewData,
  HrProfileData,
  HrSettingsData,
  InternalActivityData,
  LeaveAdjustmentData,
  LeaveRequestData,
  ProjectOptionData,
  SalaryProfileData,
  TrackingResult,
} from "./types"

import type { HrRepository } from "./repository"
import { HrServiceCore } from "./services/core"
import { HrOverviewService } from "./services/overview"
import { HrAttendanceService } from "./services/attendance"
import { HrLeaveService } from "./services/leave"
import { HrSettingsService } from "./services/settings"
import { HrPayrollService } from "./services/payroll"
import { HrRecordsService } from "./services/records"
import { HrFetchService } from "./services/fetch"
import { HrExportsService } from "./services/exports"

/**
 * HR facade. Each method delegates to the sub-domain service in
 * `./services`; shared helpers (and `getPayroll`) live on
 * `HrServiceCore`, which this class extends.
 */
export class HrService extends HrServiceCore {
  private readonly overview: HrOverviewService
  private readonly attendance: HrAttendanceService
  private readonly leave: HrLeaveService
  private readonly settings: HrSettingsService
  private readonly payroll: HrPayrollService
  private readonly records: HrRecordsService
  private readonly fetch: HrFetchService
  private readonly exports: HrExportsService

  constructor(repo: HrRepository) {
    super(repo)
    this.overview = new HrOverviewService(repo)
    this.attendance = new HrAttendanceService(repo)
    this.leave = new HrLeaveService(repo)
    this.settings = new HrSettingsService(repo)
    this.payroll = new HrPayrollService(repo)
    this.records = new HrRecordsService(repo)
    this.fetch = new HrFetchService(repo)
    this.exports = new HrExportsService(repo)
  }

  async getOverview(ctx: RequestContext): Promise<HrOverviewData> {
    return this.overview.getOverview(ctx)
  }

  async setAttendance(
    ctx: RequestContext,
    input: SetAttendanceInput
  ): Promise<AttendanceEntryData> {
    return this.attendance.setAttendance(ctx, input)
  }

  async clearAttendance(
    ctx: RequestContext,
    input: ClearAttendanceInput
  ): Promise<{ cleared: number }> {
    return this.attendance.clearAttendance(ctx, input)
  }

  async setDayStatus(
    ctx: RequestContext,
    input: SetDayStatusInput
  ): Promise<{ updated: number }> {
    return this.attendance.setDayStatus(ctx, input)
  }

  async createLeave(
    ctx: RequestContext,
    input: CreateLeaveInput
  ): Promise<LeaveRequestData> {
    return this.leave.createLeave(ctx, input)
  }

  async decideLeave(
    ctx: RequestContext,
    requestId: string,
    input: DecideLeaveInput
  ): Promise<LeaveRequestData> {
    return this.leave.decideLeave(ctx, requestId, input)
  }

  async cancelLeave(
    ctx: RequestContext,
    requestId: string
  ): Promise<LeaveRequestData> {
    return this.leave.cancelLeave(ctx, requestId)
  }

  async setAllowance(
    ctx: RequestContext,
    input: SetAllowanceInput
  ): Promise<{ userId: string; leaveType: BalanceType; year: number }> {
    return this.settings.setAllowance(ctx, input)
  }

  async adjustBalance(
    ctx: RequestContext,
    input: AdjustBalanceInput
  ): Promise<LeaveAdjustmentData> {
    return this.settings.adjustBalance(ctx, input)
  }

  async updateSettings(
    ctx: RequestContext,
    input: UpdateSettingsInput
  ): Promise<HrSettingsData> {
    return this.settings.updateSettings(ctx, input)
  }

  async updateProfile(
    ctx: RequestContext,
    input: UpdateProfileInput
  ): Promise<HrProfileData> {
    return this.settings.updateProfile(ctx, input)
  }

  async updateSalary(
    ctx: RequestContext,
    input: UpdateSalaryInput
  ): Promise<SalaryProfileData> {
    return this.payroll.updateSalary(ctx, input)
  }

  async saveClient(
    ctx: RequestContext,
    input: ClientInput
  ): Promise<ClientData> {
    return this.records.saveClient(ctx, input)
  }

  async saveActivity(
    ctx: RequestContext,
    input: ActivityInput
  ): Promise<InternalActivityData> {
    return this.records.saveActivity(ctx, input)
  }

  async updateProjectHr(
    ctx: RequestContext,
    input: ProjectHrInput
  ): Promise<ProjectOptionData> {
    return this.records.updateProjectHr(ctx, input)
  }

  async fetchAttendance(
    ctx: RequestContext,
    fromKey: string,
    toKey: string
  ): Promise<{ start: string; end: string; entries: AttendanceEntryData[] }> {
    return this.fetch.fetchAttendance(ctx, fromKey, toKey)
  }

  async fetchTracking(
    ctx: RequestContext,
    fromKey: string,
    toKey: string
  ): Promise<TrackingResult> {
    return this.fetch.fetchTracking(ctx, fromKey, toKey)
  }

  async exportCsv(ctx: RequestContext, input: ExportInput): Promise<CsvFile> {
    return this.exports.exportCsv(ctx, input)
  }
}
