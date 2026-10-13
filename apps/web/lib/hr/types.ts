export type WorkLocation = "office" | "remote"

export type LeaveType = "vacation" | "sick" | "personal" | "unpaid"

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled"

export const WORK_LOCATIONS: WorkLocation[] = ["office", "remote"]

export const LEAVE_TYPES: LeaveType[] = [
  "vacation",
  "sick",
  "personal",
  "unpaid",
]

export interface HrMember {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role: string
}

export interface WorkLocationDayData {
  userId: string
  date: string
  status: WorkLocation
  note?: string
}

export interface TimeOffRequestData {
  id: string
  userId: string
  userName: string
  type: LeaveType
  status: LeaveStatus
  startDate: string
  endDate: string
  days: number
  reason?: string
  decidedBy?: string
  decidedAt?: string
  createdAt: string
}

export interface TimeOffBalanceData {
  userId: string
  userName: string
  year: number
  allowanceDays: number
  usedDays: number
  pendingDays: number
  availableDays: number
  /** Whether an explicit allowance row exists for this user (vs. the org default). */
  configured: boolean
}

export interface TimeEntryData {
  id: string
  userId: string
  date: string
  hours: number
  note?: string
}

export interface HrSettingsData {
  defaultAllowanceDays: number
  weeklyHourTarget: number
}

export interface HrOverviewData {
  members: HrMember[]
  currentUserId: string
  /** Member or above: can set their location, request time off, log hours. */
  canTrack: boolean
  /** Admin or above: can approve requests and manage allowances/settings. */
  canManage: boolean
  settings: HrSettingsData
  year: number
  /** Server-side "today" fallback; the client prefers its local date. */
  todayKey: string
  balance: TimeOffBalanceData
  /** Populated for managers only. */
  teamBalances: TimeOffBalanceData[] | null
  myRequests: TimeOffRequestData[]
  /** Populated for managers only. */
  allRequests: TimeOffRequestData[] | null
  /** Approved leave (all members) overlapping the presence window. */
  teamLeave: TimeOffRequestData[]
  entries: TimeEntryData[]
  locations: WorkLocationDayData[]
  /** Month keys ("YYYY-MM") covered by `locations`. */
  locationMonths: string[]
}

export interface HrMonthLocations {
  month: string
  days: WorkLocationDayData[]
}
