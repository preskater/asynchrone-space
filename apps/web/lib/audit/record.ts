import { headers } from "next/headers"

import type { Prisma, PrismaClient } from "@workspace/db"

import type { RequestContext } from "@/lib/core/context"

import { SYSTEM_ACTOR_ID } from "./actions"
import {
  EMPTY_REQUEST_META,
  requestMetaFromHeaders,
  type RequestMeta,
} from "./request-meta"

/** The slice of Prisma an audit write needs; a transaction client qualifies. */
export type AuditDb = Pick<PrismaClient, "auditLog">

/**
 * The shared Prisma client, imported on first write. Keeping it out of the
 * module scope means services that merely import an audit helper (the file and
 * billing services do, and their unit tests run without a database) do not pull
 * in `lib/prisma` and its boot-time environment validation.
 */
let sharedDb: AuditDb | null = null

async function resolveDb(db?: AuditDb | null): Promise<AuditDb> {
  if (db) return db
  if (!sharedDb) {
    const { prisma } = await import("@/lib/prisma")
    sharedDb = prisma
  }
  return sharedDb
}

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

type AuditContext = Pick<
  RequestContext,
  "organizationId" | "userId" | "userName" | "userEmail"
>

const MAX_LABEL_LENGTH = 200

/**
 * JSON-serialisable copy of a snapshot. Drops values Prisma cannot store
 * (functions, circular references) instead of failing the caller's mutation.
 */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  try {
    const encoded = JSON.stringify(value)
    if (encoded === undefined) return undefined
    return JSON.parse(encoded) as Prisma.InputJsonValue
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

function toRow(entry: AuditEntry): Prisma.AuditLogCreateManyInput {
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
 * The one way to write an audit row. Every mutating server action calls this
 * (see `docs/audit-log.md`), so the settings page, the retention job and the
 * export all read a single, uniform table.
 *
 * Errors propagate: a mutation that cannot be audited should fail rather than
 * change data silently. The only caller that swallows a failure is the Better
 * Auth after-hook, where the change is already committed.
 */
export async function recordAudit(
  entry: AuditEntry,
  db?: AuditDb | null
): Promise<void> {
  const target = await resolveDb(db)
  await target.auditLog.create({ data: toRow(entry) })
}

/** Writes several rows in one statement (bulk file and import operations). */
export async function recordAuditMany(
  entries: AuditEntry[],
  db?: AuditDb | null
): Promise<void> {
  if (entries.length === 0) return
  const target = await resolveDb(db)
  await target.auditLog.createMany({ data: entries.map(toRow) })
}

/** Request IP and user agent, or empty values outside a request scope. */
export async function currentRequestMeta(): Promise<RequestMeta> {
  try {
    return requestMetaFromHeaders(await headers())
  } catch {
    return EMPTY_REQUEST_META
  }
}

/** Records one change made by the acting user of `ctx`. */
export async function recordUserAudit(
  ctx: AuditContext,
  input: UserAuditInput,
  db?: AuditDb | null
): Promise<void> {
  const meta = await currentRequestMeta()
  await recordAudit(
    {
      ...input,
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorName: ctx.userName,
      actorEmail: ctx.userEmail,
      ...meta,
    },
    db
  )
}

/** Records several changes made by the acting user of `ctx`. */
export async function recordUserAuditMany(
  ctx: AuditContext,
  inputs: UserAuditInput[],
  db?: AuditDb | null
): Promise<void> {
  if (inputs.length === 0) return
  const meta = await currentRequestMeta()
  await recordAuditMany(
    inputs.map((input) => ({
      ...input,
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorName: ctx.userName,
      actorEmail: ctx.userEmail,
      ...meta,
    })),
    db
  )
}

/** Records a change made by a job or a provider webhook. */
export function recordSystemAudit(
  entry: Omit<AuditEntry, "actorId">,
  db?: AuditDb | null
): Promise<void> {
  return recordAudit({ ...entry, actorId: SYSTEM_ACTOR_ID }, db)
}

/**
 * Fills `actorName`/`actorEmail` from the user table for callers that only
 * carry ids (the CRM and HR repositories build their entries from `ctx.userId`).
 * Snapshotting keeps the row readable once the account is gone.
 */
export async function withActorIdentity<
  T extends {
    actorId: string
    actorName?: string | null
    actorEmail?: string | null
  },
>(entries: T[], db: Pick<PrismaClient, "user">): Promise<T[]> {
  const missing = entries.filter(
    (entry) => !entry.actorName && entry.actorId !== SYSTEM_ACTOR_ID
  )
  if (missing.length === 0) return entries
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(missing.map((entry) => entry.actorId))] } },
    select: { id: true, name: true, email: true },
  })
  const byId = new Map(users.map((user) => [user.id, user]))
  return entries.map((entry) => {
    const user = byId.get(entry.actorId)
    if (!user) return entry
    return {
      ...entry,
      actorName: entry.actorName ?? user.name,
      actorEmail: entry.actorEmail ?? user.email,
    }
  })
}

export { SYSTEM_ACTOR_ID }
