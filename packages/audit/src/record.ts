import type { AuditCreateInput, AuditDb, AuditJsonValue } from "./db"
import { SYSTEM_ACTOR_ID } from "./actions"

export interface AuditEntry {
  organizationId: string
  /** Acting user id, or {@link SYSTEM_ACTOR_ID} for jobs and webhooks. */
  actorId: string
  actorName?: string | null
  actorEmail?: string | null
  action: string
  entityType: string
  entityId: string
  /** Human label of the target at write time, e.g. `AS-12` or a file name. */
  entityLabel?: string | null
  before?: unknown
  after?: unknown
  ipAddress?: string | null
  userAgent?: string | null
}

/** An entry for the acting user; identity and request metadata are filled in. */
export type UserAuditInput = Omit<
  AuditEntry,
  | "organizationId"
  | "actorId"
  | "actorName"
  | "actorEmail"
  | "ipAddress"
  | "userAgent"
>

export interface AuditActor {
  organizationId: string
  userId: string
  userName: string | null
  userEmail: string | null
}

export interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
}

const MAX_LABEL_LENGTH = 200

/**
 * JSON-serialisable copy of a snapshot. Drops values Prisma cannot store
 * (functions, circular references) instead of failing the caller's mutation.
 */
function toJson(value: unknown): AuditJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  try {
    const encoded = JSON.stringify(value)
    if (encoded === undefined) return undefined
    return JSON.parse(encoded) as AuditJsonValue
  } catch {
    return undefined
  }
}

function label(value: string | null | undefined): string | null {
  if (!value) return null
  return value.length > MAX_LABEL_LENGTH
    ? value.slice(0, MAX_LABEL_LENGTH)
    : value
}

function toRow(entry: AuditEntry): AuditCreateInput {
  return {
    organizationId: entry.organizationId,
    actorId: entry.actorId,
    actorName: label(entry.actorName),
    actorEmail: label(entry.actorEmail),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: label(entry.entityLabel),
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    before: toJson(entry.before),
    after: toJson(entry.after),
  }
}

/**
 * The one way to write an audit row. Every mutating action calls this, so the
 * settings page, the retention job and the export all read a single, uniform
 * table in the app that owns the changed data.
 *
 * Errors propagate: a mutation that cannot be audited should fail rather than
 * change data silently. The only caller that swallows a failure is the Better
 * Auth after-hook, where the change is already committed.
 */
export async function recordAudit(
  entry: AuditEntry,
  db: AuditDb
): Promise<void> {
  await db.auditLog.create({ data: toRow(entry) })
}

/** Writes several rows in one statement (bulk file and import operations). */
export async function recordAuditMany(
  entries: AuditEntry[],
  db: AuditDb
): Promise<void> {
  if (entries.length === 0) return
  await db.auditLog.createMany({ data: entries.map(toRow) })
}

/** Records one change made by the acting user of `actor`. */
export function userAuditEntry(
  actor: AuditActor,
  input: UserAuditInput,
  meta: RequestMeta
): AuditEntry {
  return {
    ...input,
    organizationId: actor.organizationId,
    actorId: actor.userId,
    actorName: actor.userName,
    actorEmail: actor.userEmail,
    ...meta,
  }
}

/** Records one change made by the acting user of `actor`. */
export async function recordUserAudit(
  actor: AuditActor,
  input: UserAuditInput,
  meta: RequestMeta,
  db: AuditDb
): Promise<void> {
  await recordAudit(userAuditEntry(actor, input, meta), db)
}

/** Records several changes made by the acting user of `actor`. */
export async function recordUserAuditMany(
  actor: AuditActor,
  inputs: UserAuditInput[],
  meta: RequestMeta,
  db: AuditDb
): Promise<void> {
  if (inputs.length === 0) return
  await recordAuditMany(
    inputs.map((input) => userAuditEntry(actor, input, meta)),
    db
  )
}

/** Records a change made by a job or a provider webhook. */
export function recordSystemAudit(
  entry: Omit<AuditEntry, "actorId">,
  db: AuditDb
): Promise<void> {
  return recordAudit({ ...entry, actorId: SYSTEM_ACTOR_ID }, db)
}

export { SYSTEM_ACTOR_ID }
