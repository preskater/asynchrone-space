/**
 * Turns the `before`/`after` JSON snapshots of an audit row into the short list
 * of changed fields the settings table and the CSV export display.
 *
 * Values come back from PostgreSQL as plain JSON, so only JSON types are
 * handled here.
 */
export interface AuditChange {
  field: string
  before: string | null
  after: string | null
}

const MAX_FIELDS = 20
const MAX_VALUE_LENGTH = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function truncate(value: string): string {
  return value.length > MAX_VALUE_LENGTH
    ? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…`
    : value
}

/** Renders one snapshot value for display; `null` means "not set". */
export function formatAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return truncate(value)
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value)
  }
  if (typeof value === "boolean") return value ? "true" : "false"
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return truncate(
      value.map((item) => formatAuditValue(item) ?? "—").join(", ")
    )
  }
  if (isRecord(value)) {
    try {
      return truncate(JSON.stringify(value))
    } catch {
      return null
    }
  }
  return null
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * The fields that differ between two snapshots, in the order of the `after`
 * snapshot. A single non-object snapshot (a bare string, say) is reported as
 * the `value` field.
 */
export function auditChanges(before: unknown, after: unknown): AuditChange[] {
  const beforeIsRecord = isRecord(before)
  const afterIsRecord = isRecord(after)

  if (!beforeIsRecord && !afterIsRecord) {
    if (before === undefined && after === undefined) return []
    if (sameValue(before, after)) return []
    return [
      {
        field: "value",
        before: formatAuditValue(before),
        after: formatAuditValue(after),
      },
    ]
  }

  const left = beforeIsRecord ? before : {}
  const right = afterIsRecord ? after : {}
  const fields = new Set([...Object.keys(right), ...Object.keys(left)])

  const changes: AuditChange[] = []
  for (const field of fields) {
    if (sameValue(left[field], right[field])) continue
    changes.push({
      field,
      before: formatAuditValue(left[field]),
      after: formatAuditValue(right[field]),
    })
    if (changes.length === MAX_FIELDS) break
  }
  return changes
}
