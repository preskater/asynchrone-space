/**
 * Keyset (cursor) pagination helpers.
 *
 * Cursors are opaque strings encoding the last row's sort tuple. They are not
 * encrypted: they only contain ordering values the caller already sees.
 */

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100

export interface PageInput {
  /** Opaque cursor returned by the previous page. */
  cursor?: string | null
  /** Requested page size (clamped to `MAX_PAGE_SIZE`). */
  limit?: number | null
}

export interface Page<T> {
  items: T[]
  /** Pass to the next request; `null` when this was the last page. */
  nextCursor: string | null
}

type CursorPart = string | number | null | undefined

/** Clamp a requested page size into `[1, MAX_PAGE_SIZE]`. */
export function pageSize(
  limit: number | null | undefined,
  fallback = DEFAULT_PAGE_SIZE
): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return fallback
  return Math.min(Math.floor(limit), MAX_PAGE_SIZE)
}

export function encodeCursor(parts: CursorPart[]): string {
  return Buffer.from(JSON.stringify(parts), "utf8").toString("base64url")
}

/** Decode a cursor, returning `null` for missing or malformed values. */
export function decodeCursor(
  cursor: string | null | undefined
): string[] | null {
  if (!cursor) return null
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    )
    if (!Array.isArray(parsed)) return null
    return parsed.map((part) => (part === null ? "" : String(part)))
  } catch {
    return null
  }
}

/**
 * Fetch `limit + 1` rows and derive the next cursor from the extra row.
 * `cursorFor` builds the cursor for the last item of the returned page.
 */
export function toPage<T>(
  rows: T[],
  limit: number,
  cursorFor: (row: T) => string
): Page<T> {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  return {
    items,
    nextCursor: hasMore && last ? cursorFor(last) : null,
  }
}
