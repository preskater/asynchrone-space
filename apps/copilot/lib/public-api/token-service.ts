import {
  ApiTokenSummarySchema,
  isPublicApiScope,
  PUBLIC_API_SCOPE_VALUES,
  type ApiTokenSummary,
} from "@workspace/contracts"
import type { RequestContext } from "@workspace/core/context"
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@workspace/core/errors"
import { z } from "zod"

import { recordUserAudit } from "@/lib/audit"
import { AUDIT_ACTIONS } from "@/lib/audit/actions"
import { requireEntitlement } from "@/lib/organization/entitlements"
import { prisma } from "@/lib/prisma"

import { generateApiToken, hashApiToken, tokenDisplayPrefix } from "./tokens"

/** A workspace can keep at most this many usable tokens at once. */
export const MAX_ACTIVE_API_TOKENS = 50

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.string().min(1)).min(1).max(PUBLIC_API_SCOPE_VALUES.length),
  /** `null`/omitted means the token never expires. */
  expiresInDays: z.number().int().min(1).max(730).nullable().optional(),
})
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>

type AuditContext = Pick<
  RequestContext,
  "organizationId" | "userId" | "userName" | "userEmail" | "actor"
>

const TOKEN_SELECT = {
  id: true,
  name: true,
  prefix: true,
  scopes: true,
  createdAt: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
} as const

type TokenRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
}

function summary(row: TokenRow): ApiTokenSummary {
  return ApiTokenSummarySchema.parse({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  })
}

function normalizeScopes(scopes: string[]): string[] {
  const unique = [...new Set(scopes)]
  const unknown = unique.filter((scope) => !isPublicApiScope(scope))
  if (unknown.length > 0) {
    throw new ValidationError(`Unknown scopes: ${unknown.join(", ")}.`, {
      scopes: unknown,
    })
  }
  return unique
}

/**
 * Creates a token and returns the raw value exactly once. Only the SHA-256
 * hash is persisted; the settings list never sees either the raw value or the
 * hash.
 */
export async function createApiToken(
  ctx: AuditContext,
  input: CreateApiTokenInput
): Promise<{ token: string; item: ApiTokenSummary }> {
  const scopes = normalizeScopes(input.scopes)
  await requireEntitlement(ctx.organizationId, "apiAccess")

  const now = new Date()
  const active = await prisma.apiToken.count({
    where: {
      organizationId: ctx.organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  })
  if (active >= MAX_ACTIVE_API_TOKENS) {
    throw new ConflictError(
      `A workspace can have at most ${MAX_ACTIVE_API_TOKENS} active API tokens.`
    )
  }

  const token = generateApiToken()
  const expiresAt =
    input.expiresInDays == null
      ? null
      : new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000)

  const row = await prisma.apiToken.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name,
      prefix: tokenDisplayPrefix(token),
      hashedToken: hashApiToken(token),
      scopes,
      createdById: ctx.userId,
      expiresAt,
    },
    select: TOKEN_SELECT,
  })

  await recordUserAudit(ctx, {
    action: AUDIT_ACTIONS.apiTokenCreated,
    entityType: "apiToken",
    entityId: row.id,
    entityLabel: row.name,
    after: {
      scopes: row.scopes,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    },
  })

  return { token, item: summary(row) }
}

/** Most recent first; revoked tokens stay visible so they remain auditable. */
export async function listApiTokens(
  ctx: Pick<RequestContext, "organizationId">
): Promise<ApiTokenSummary[]> {
  const rows = await prisma.apiToken.findMany({
    where: { organizationId: ctx.organizationId },
    select: TOKEN_SELECT,
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map(summary)
}

/** Revocation is immediate and idempotent; the organization is always scoped. */
export async function revokeApiToken(
  ctx: AuditContext,
  id: string
): Promise<{ id: string }> {
  const existing = await prisma.apiToken.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true, name: true, revokedAt: true },
  })
  if (!existing) throw new NotFoundError("API token")
  if (existing.revokedAt) return { id: existing.id }

  const revokedAt = new Date()
  await prisma.apiToken.update({
    where: { id: existing.id },
    data: { revokedAt },
  })
  await recordUserAudit(ctx, {
    action: AUDIT_ACTIONS.apiTokenRevoked,
    entityType: "apiToken",
    entityId: existing.id,
    entityLabel: existing.name,
    before: { revokedAt: null },
    after: { revokedAt: revokedAt.toISOString() },
  })
  return { id: existing.id }
}
