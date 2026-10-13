import type { TimeEntryData, TimeOffRequestData, WorkLocationDayData } from "./types"

/** Whether an approved/any request covers `dateKey` (string keys sort ISO-lexically). */
export function coversDate(
  request: TimeOffRequestData,
  dateKey: string
): boolean {
  return request.startDate <= dateKey && request.endDate >= dateKey
}

/** Whether `userId` is away on approved leave on `dateKey`. */
export function isOnLeave(
  requests: TimeOffRequestData[],
  userId: string,
  dateKey: string
): boolean {
  return requests.some(
    (request) =>
      request.userId === userId &&
      request.status === "approved" &&
      coversDate(request, dateKey)
  )
}

/** The declared work location for one user on one day, if any. */
export function locationOnDate(
  locations: WorkLocationDayData[],
  userId: string,
  dateKey: string
): WorkLocationDayData | undefined {
  return locations.find(
    (location) => location.userId === userId && location.date === dateKey
  )
}

/** Trim float noise from hour totals (7.499999 -> "7.5"). */
export function formatHours(hours: number): string {
  return (Math.round(hours * 100) / 100).toString()
}

/** Total of a set of time entries, rounded to two decimals. */
export function sumHours(entries: TimeEntryData[]): number {
  return Math.round(entries.reduce((total, entry) => total + entry.hours, 0) * 100) / 100
}
