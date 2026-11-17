import { headers } from "next/headers"

import {
  recordUserAudit as recordUserAuditWithMeta,
  recordUserAuditMany as recordUserAuditManyWithMeta,
  requestMetaFromHeaders,
  type AuditDb,
  type UserAuditInput,
} from "@workspace/audit"
import type { RequestContext } from "@workspace/core/context"

import { prisma } from "@/lib/prisma"

/**
 * Audit writes for the files app.
 *
 * Rows land in this app's own `auditLog` table (shared model, per-app database)
 * and Copilot aggregates them through `/internal/v1/audit`. Errors propagate:
 * a mutation that cannot be audited must fail.
 */
export async function recordUserAudit(
  ctx: Pick<
    RequestContext,
    "organizationId" | "userId" | "userName" | "userEmail" | "actor"
  >,
  input: UserAuditInput,
  db: AuditDb = prisma
): Promise<void> {
  const meta = await requestMetaFromHeaders(await headers())
  await recordUserAuditWithMeta(
    {
      organizationId: ctx.organizationId,
      userId: ctx.actor?.id ?? ctx.userId,
      userName: ctx.actor?.name ?? ctx.userName,
      userEmail: ctx.actor?.email ?? ctx.userEmail,
    },
    input,
    meta,
    db
  )
}

export async function recordUserAuditMany(
  ctx: Pick<
    RequestContext,
    "organizationId" | "userId" | "userName" | "userEmail" | "actor"
  >,
  inputs: UserAuditInput[],
  db: AuditDb = prisma
): Promise<void> {
  const meta = await requestMetaFromHeaders(await headers())
  await recordUserAuditManyWithMeta(
    {
      organizationId: ctx.organizationId,
      userId: ctx.actor?.id ?? ctx.userId,
      userName: ctx.actor?.name ?? ctx.userName,
      userEmail: ctx.actor?.email ?? ctx.userEmail,
    },
    inputs,
    meta,
    db
  )
}

export type { UserAuditInput }
