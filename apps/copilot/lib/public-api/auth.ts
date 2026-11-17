import {
  hasPublicApiScope,
  PublicApiMeSchema,
  type MemberRole,
  type PublicApiMe,
  type PublicApiScope,
} from "@workspace/contracts"
import { parseRoles } from "@workspace/organization/roles"
import type { OrgPlan } from "@workspace/core/plans"

import { rateLimit } from "@/lib/core/rate-limit"
import {
  entitlementsFor,
  getOrganizationPlan,
} from "@/lib/organization/entitlements"
import { prisma } from "@/lib/prisma"

import {
  expiredToken,
  insufficientScope,
  invalidToken,
  missingToken,
  PublicApiError,
  revokedToken,
} from "./errors"
import { apiTokenActorId, API_TOKEN_PREFIX, hashApiToken } from "./tokens"

const ORG_HEADER = "x-asynchrone-organization"
const WINDOW_MS = 60_000
const LAST_USED_THROTTLE_MS = 5 * 60_000

export interface PublicApiContext {
  requestId: string
  token: {
    id: string
    name: string
    prefix: string
    scopes: string[]
    expiresAt: Date | null
  }
  organization: { id: string; name: string; slug: string }
  userId: string
  userName: string
  userEmail: string
  /** The member's cumulative roles, client accounts excluded. */
  roles: Exclude<MemberRole, "client">[]
  /** The primary role shown by `/me`. */
  role: Exclude<MemberRole, "client">
  plan: OrgPlan
  limits: { requestsPerMinute: number }
  rate: { limit: number; remaining: number; resetAt: number }
  /** The stable actor written to audit rows of API mutations. */
  actor: { id: string; name: string; email: string }
  me: PublicApiMe
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization")
  if (!header) throw missingToken()
  const [scheme, value] = header.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    throw invalidToken("The Authorization header must use the Bearer scheme.")
  }
  return value
}

function rolesOf(value: string): Exclude<MemberRole, "client">[] {
  return parseRoles(value).filter(
    (role): role is Exclude<MemberRole, "client"> => role !== "client"
  )
}

/**
 * Resolves the token, its organization, the creator's current membership and
 * the plan limit. Every request re-reads the membership and the token row so
 * revocation and role changes apply immediately.
 */
export async function authenticatePublicApi(
  request: Request,
  requestId: string,
  requiredScope?: PublicApiScope
): Promise<PublicApiContext> {
  const raw = bearerToken(request)
  if (!raw.startsWith(API_TOKEN_PREFIX)) {
    throw invalidToken("The token has an unknown format.")
  }

  const row = await prisma.apiToken.findUnique({
    where: { hashedToken: hashApiToken(raw) },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  })
  if (!row) throw invalidToken()
  if (row.revokedAt) throw revokedToken()
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    throw expiredToken()
  }

  const requestedOrganization = request.headers.get(ORG_HEADER)?.trim()
  if (
    requestedOrganization &&
    requestedOrganization !== row.organizationId &&
    requestedOrganization !== row.organization.slug
  ) {
    throw new PublicApiError(
      "organization_mismatch",
      "This token belongs to a different organization.",
      { status: 403 }
    )
  }

  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: row.organizationId,
        userId: row.createdById,
      },
    },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })
  if (!member) {
    throw revokedToken(
      "The member who created this token is no longer in the organization."
    )
  }
  const roles = rolesOf(member.role)
  if (roles.length === 0) {
    throw new PublicApiError(
      "forbidden",
      "Client portal accounts cannot use the public API.",
      { status: 403 }
    )
  }
  const role = roles[0] ?? "viewer"
  if (requiredScope && !hasPublicApiScope(row.scopes, requiredScope)) {
    throw insufficientScope(requiredScope)
  }

  const plan = await getOrganizationPlan(row.organizationId)
  const entitlements = entitlementsFor(plan)
  if (!entitlements.apiAccess || entitlements.apiRequestsPerMinute <= 0) {
    throw new PublicApiError(
      "upgrade_required",
      "The public API is not available on this plan.",
      { status: 403 }
    )
  }

  const limited = await rateLimit(
    `api-token:${row.id}`,
    entitlements.apiRequestsPerMinute,
    WINDOW_MS,
    { failOpen: false }
  )
  if (!limited.allowed) {
    throw new PublicApiError(
      "rate_limited",
      "Too many requests for this token.",
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfter),
          ...rateLimitHeaders(entitlements.apiRequestsPerMinute, {
            remaining: 0,
            resetAt: limited.resetAt,
          }),
        },
      }
    )
  }

  // Best-effort and throttled: a write on every request would double the cost
  // of the cheapest endpoint.
  void prisma.apiToken
    .updateMany({
      where: {
        id: row.id,
        OR: [
          { lastUsedAt: null },
          { lastUsedAt: { lt: new Date(Date.now() - LAST_USED_THROTTLE_MS) } },
        ],
      },
      data: { lastUsedAt: new Date() },
    })
    .catch((error) =>
      console.error("[public-api] lastUsedAt update failed", error)
    )

  const actor = {
    id: apiTokenActorId(row.id),
    name: row.name,
    email: member.user.email,
  }
  const me = PublicApiMeSchema.parse({
    token: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    },
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
    },
    plan,
    role,
    limits: { requestsPerMinute: entitlements.apiRequestsPerMinute },
  })

  return {
    requestId,
    token: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      expiresAt: row.expiresAt,
    },
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
    },
    userId: member.user.id,
    userName: member.user.name,
    userEmail: member.user.email,
    roles,
    role,
    plan,
    limits: { requestsPerMinute: entitlements.apiRequestsPerMinute },
    rate: {
      limit: entitlements.apiRequestsPerMinute,
      remaining: limited.remaining,
      resetAt: limited.resetAt,
    },
    actor,
    me,
  }
}

export function rateLimitHeaders(
  limit: number,
  result: { remaining: number; resetAt: number }
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  }
}
