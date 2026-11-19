/** Date helpers for client fields stored as `YYYY-MM-DD` day keys. */

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Local calendar day of a timestamp (today, createdAt, releasedAt). */
export function toDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Parse a day key as local midnight (avoids UTC boundary shifts). */
export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`)
}

/**
 * `@db.Date` columns (deal close dates): Prisma writes and reads them as UTC
 * midnight, so the local helpers above would shift the day off UTC.
 */
export function parseDateColumn(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

export function toDateColumnKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DAY_KEY_PATTERN.test(value)
}
