import { z } from "zod"

import { MemberRoleSchema } from "../internal/contracts"

/**
 * Stable shapes of the public `/api/v1` surface. Route handlers validate
 * requests and build responses from these schemas so the OpenAPI document and
 * the implementation cannot drift.
 */
export const PUBLIC_API_PREFIX = "/api/v1" as const
export const PUBLIC_API_ME_PATH = `${PUBLIC_API_PREFIX}/me` as const

/** Error codes the gateway itself returns. Domain errors may add their own. */
export const PUBLIC_API_ERROR_CODES = [
  "missing_token",
  "invalid_token",
  "expired_token",
  "revoked_token",
  "insufficient_scope",
  "organization_mismatch",
  "upgrade_required",
  "rate_limited",
  "validation_error",
  "not_found",
  "forbidden",
  "conflict",
  "internal_error",
] as const
export type PublicApiErrorCode = (typeof PUBLIC_API_ERROR_CODES)[number]

export const PublicApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z.object({ requestId: z.string().min(1) }),
})
export type PublicApiErrorBody = z.infer<typeof PublicApiErrorSchema>

/** `limit` and `cursor` accepted by every list endpoint. */
export const PublicApiPageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
})
export type PublicApiPageQuery = z.infer<typeof PublicApiPageQuerySchema>

/** Every successful delete returns the deleted resource id. */
export const PublicDeleteResultSchema = z.object({
  id: z.string().min(1),
})
export type PublicDeleteResult = z.infer<typeof PublicDeleteResultSchema>

/** A token as listed in settings; never contains the raw value or the hash. */
export const ApiTokenSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  prefix: z.string().min(1),
  scopes: z.array(z.string().min(1)),
  expiresAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type ApiTokenSummary = z.infer<typeof ApiTokenSummarySchema>

export const PublicApiMeSchema = z.object({
  token: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    prefix: z.string().min(1),
    scopes: z.array(z.string().min(1)),
    expiresAt: z.string().datetime().nullable(),
  }),
  organization: z.object({
    id: z.string().min(1),
    name: z.string(),
    slug: z.string().min(1),
  }),
  plan: z.enum(["free", "team", "enterprise"]),
  role: z.enum(["owner", "admin", "member", "viewer"]),
  limits: z.object({
    requestsPerMinute: z.number().int().nonnegative(),
  }),
})
export type PublicApiMe = z.infer<typeof PublicApiMeSchema>

/** `GET /api/v1/token`: the calling token, its owner and its organization. */
export const PublicApiTokenInfoSchema = z.object({
  prefix: z.string().min(1),
  scopes: z.array(z.string().min(1)),
  expiresAt: z.string().datetime().nullable(),
  user: z.object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string().email(),
  }),
  organization: z.object({
    id: z.string().min(1),
    name: z.string(),
    slug: z.string().min(1),
  }),
})
export type PublicApiTokenInfo = z.infer<typeof PublicApiTokenInfoSchema>

/** `GET /api/v1/members`: a workspace member (portal accounts excluded). */
export const PublicApiMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  roles: z.array(MemberRoleSchema),
})
export type PublicApiMember = z.infer<typeof PublicApiMemberSchema>
