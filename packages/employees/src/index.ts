import { prisma } from "@workspace/db"

import { EmployeesRepository } from "./repository"
import { EmployeesService } from "./service"

export const employeesRepository = new EmployeesRepository(prisma)
export const employeesService = new EmployeesService(employeesRepository)

export { EmployeesRepository, EmployeesService }
export { resolveEmployeesAccess } from "./access"
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
