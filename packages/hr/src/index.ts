import { prisma } from "@workspace/db"

import { HrRepository } from "./repository"
import { HrService } from "./service"

export const hrRepository = new HrRepository(prisma)
export const hrService = new HrService(hrRepository)

export { HrRepository, HrService }
export { resolveHrAccess } from "./access"
export { buildAlerts } from "./alerts"
export {
  computeCapacityMonth,
  computeCapacityRows,
  computeCapacityTotals,
  computeCapacityWeeks,
} from "./capacity"
export { formatCsvNumber, toCsv } from "./csv"
export {
  frenchHolidays,
  holidaysInRange,
  isWorkingDayKey,
  type HolidayKey,
} from "./holidays"
export * from "./schemas"
export {
  addDaysToKey,
  addMonthsToKey,
  addWeeksToKey,
  countBusinessDays,
  eachDateKey,
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
export {
  coversDate,
  dailyHours,
  entryIndex,
  entryOn,
  formatHours,
  halfDayHours,
  halfKey,
  halfKeysBetween,
  leaveStatusOnDate,
  sum,
  weekStartsFrom,
  workingDaysInRange,
  workingHalvesInRange,
} from "./utils"
export * from "./types"
