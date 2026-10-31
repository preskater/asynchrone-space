import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRoles } from "@/lib/organization/utils"
import type { OrgRole } from "@/lib/organization/roles"

import { UnauthorizedError, ForbiddenError } from "@workspace/core/errors"
import type { RequestContext } from "@workspace/core/context"

const DEFAULT_ROLE: OrgRole = "member"

function resolveRole(role: string | null | undefined): OrgRole {
  const roles = parseRoles(role)
  return roles[0] ?? DEFAULT_ROLE
}

/** Builds the context for `user` acting in `organizationId`. */
export async function contextForMember(
  user: { id: string; name: string; email: string },
  organizationId: string
): Promise<RequestContext> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId: user.id },
    select: { role: true, clientId: true },
  })

  if (!member) throw new ForbiddenError()
  // Client-portal members only ever act through the portal endpoints.
  if (member.clientId) {
    throw new ForbiddenError("Portal accounts cannot access the workspace.")
  }

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    organizationId,
    role: resolveRole(member.role),
  }
}

async function contextFromSession(): Promise<RequestContext | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return null

  return contextForMember(session.user, organizationId)
}

export interface GetRequestContextOptions {
  request?: Request
  required?: boolean
}

export async function getRequestContext(
  _options: GetRequestContextOptions = {}
): Promise<RequestContext> {
  // The web app and its API routes authenticate with the session cookie.
  // Machine-to-machine access goes through the OAuth2-protected MCP endpoint
  // (`app/mcp/route.ts`), which builds its own context from verified tokens.
  const ctx = await contextFromSession()
  if (ctx) return ctx

  throw new UnauthorizedError()
}

export async function getOptionalRequestContext(): Promise<RequestContext | null> {
  try {
    return await contextFromSession()
  } catch {
    return null
  }
}

export async function getRequestContextForOrganization(
  organizationId: string
): Promise<RequestContext> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new UnauthorizedError()

  return contextForMember(session.user, organizationId)
}

export function requirePermission(ctx: RequestContext, allowed: OrgRole[]) {
  if (allowed.includes(ctx.role)) return
  throw new ForbiddenError()
}
