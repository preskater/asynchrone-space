"use client"

import * as React from "react"

import { useCalendars } from "@workspace/calendars/store"
import type { CalendarView } from "@workspace/calendars/types"

interface CalendarsNavStore {
  calendarView: CalendarView
  setCalendarView: (view: CalendarView) => void
  calendarFocusDate: Date
  setCalendarFocusDate: React.Dispatch<React.SetStateAction<Date>>
  calendarSelectedMemberIds: string[]
  toggleCalendarMember: (memberId: string) => void
}

const CalendarsNavContext = React.createContext<CalendarsNavStore | null>(null)

export function CalendarsNavProvider({ children }: { children: React.ReactNode }) {
  const { members, currentUserId } = useCalendars()
  const [calendarView, setCalendarView] = React.useState<CalendarView>("week")
  const [calendarFocusDate, setCalendarFocusDate] = React.useState<Date>(() => new Date())
  const [calendarSelectedMemberIds, setCalendarSelectedMemberIds] = React.useState<string[]>(() =>
    members.filter((member) => member.id !== currentUserId).map((member) => member.id)
  )

  const store = React.useMemo<CalendarsNavStore>(
    () => ({
      calendarView,
      setCalendarView,
      calendarFocusDate,
      setCalendarFocusDate,
      calendarSelectedMemberIds,
      toggleCalendarMember: (memberId) =>
        setCalendarSelectedMemberIds((prev) =>
          prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
        ),
    }),
    [calendarView, calendarFocusDate, calendarSelectedMemberIds]
  )

  return <CalendarsNavContext.Provider value={store}>{children}</CalendarsNavContext.Provider>
}

export function useWorkspaceNav() {
  const context = React.useContext(CalendarsNavContext)
  if (!context) throw new Error("useWorkspaceNav must be used within CalendarsNavProvider")
  return context
}
