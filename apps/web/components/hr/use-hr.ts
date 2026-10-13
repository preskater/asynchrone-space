"use client"

import * as React from "react"

import { localDateKey } from "@/lib/hr/date-utils"

/**
 * The user's local calendar day ("YYYY-MM-DD"). Starts from the server's
 * `todayKey` (deterministic during SSR) and switches to the browser's date
 * after mount, so the page always matches the user's wall clock.
 */
export function useTodayKey(serverToday: string): string {
  const [today, setToday] = React.useState(serverToday)
  React.useEffect(() => {
    setToday(localDateKey(new Date()))
  }, [])
  return today
}
