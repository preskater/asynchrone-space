import { describe, expect, it } from "vitest"

import { parseDateColumn, toDateColumnKey, toDateKey } from "./dates"

describe("date column keys", () => {
  it("round-trips a @db.Date day whatever the server time zone", () => {
    // A @db.Date keeps only the UTC calendar day and is read back at UTC midnight.
    const throughColumn = (date: Date) =>
      new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`)
    for (const key of ["2000-01-01", "2026-12-31", "0056-01-05"]) {
      expect(toDateColumnKey(throughColumn(parseDateColumn(key)))).toBe(key)
    }
  })

  it("pads years below 1000 to four digits", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05")
    const early = new Date(2000, 0, 5)
    early.setFullYear(56)
    expect(toDateKey(early)).toBe("0056-01-05")
  })
})
