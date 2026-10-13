import { prisma } from "@/lib/prisma"

import { HrRepository } from "./repository"
import { HrService } from "./service"

export const hrRepository = new HrRepository(prisma)
export const hrService = new HrService(hrRepository)

export { HrRepository, HrService }
export * from "./schemas"
export {
  addDaysToKey,
  addMonthsToKey,
  businessDaysInYear,
  countBusinessDays,
  formatDateKey,
  isDateKey,
  isMonthKey,
  isWeekendKey,
  localDateFromKey,
  localDateKey,
  monthDateRange,
  monthKeyOf,
  parseDateKey,
  round2,
  startOfWeekKey,
  toDateKey,
} from "./date-utils"
export type {
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
