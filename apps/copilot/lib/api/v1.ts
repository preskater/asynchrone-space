import { NextResponse } from "next/server"

import { DomainClientError, type PublicApiScope } from "@workspace/contracts"
import { appOrigin } from "@workspace/contracts/server"
import type { RequestContext } from "@workspace/core/context"
import { AppError, toAppError, type ErrorCode } from "@workspace/core/errors"
import {
  CORRELATION_HEADER,
  withObservedRoute,
} from "@workspace/observability/next"

import {
  authenticatePublicApi,
  publicErrorResponse,
  rateLimitHeaders,
} from "@/lib/public-api"
import { prisma } from "@/lib/prisma"

/** Requests per token per minute (ADR 0044); kept for the legacy routes. */
export const API_RATE_LIMITS = {
  free: 60,
  team: 300,
  enterprise: 1200,
} as const

/**
 * A domain app's refusal (404 for another organization's id, 403 for the
 * owner's role, 422 for invalid input) keeps its status and code instead of
 * turning into a 500.
 */
export function apiError(error: unknown): AppError {
  if (error instanceof DomainClientError && error.status < 500) {
    return new AppError(error.code as ErrorCode, error.message, {
      status: error.status,
    })
  }
  return toAppError(error)
}

/** `{ data }` with no caching: every response is per token. */
export function apiJson(data: unknown, init: { status?: number } = {}) {
  return NextResponse.json(
    { data },
    { status: init.status, headers: { "Cache-Control": "no-store" } }
  )
}

/** `{ data, nextCursor }` for list endpoints. */
export function apiList(data: unknown[]) {
  return NextResponse.json(
    { data, nextCursor: null },
    { headers: { "Cache-Control": "no-store" } }
  )
}

/** The `/api/v1` user agent sent to domain apps, so their audit rows name the token. */
export function apiUserAgent(token: VerifiedApiToken, request: Request) {
  const client = request.headers.get("user-agent")?.slice(0, 200)
  return `asynchrone-api (token ${token.prefix})${client ? ` ${client}` : ""}`
}

/** A public API token in the shape the `/api/v1` routes callers expect. */
export interface VerifiedApiToken {
  ctx: RequestContext
  tokenId: string
  prefix: string
  scopes: PublicApiScope[]
  expiresAt: Date | null
}

/**
 * Every `/api/v1` handler: the shared public API authentication (bearer token,
 * `apiAccess`, per-token rate limit, scope). Cookies are never read, so there
 * is no CSRF surface.
 */
export function withApiToken<TParams = Record<string, never>>(
  route: string,
  /** null for routes every valid token may call (token introspection). */
  scope: PublicApiScope | null,
  handler: (
    token: VerifiedApiToken,
    request: Request,
    params: TParams
  ) => Promise<Response>
) {
  return withObservedRoute<{ params: Promise<TParams> }>(
    { app: "copilot", route },
    async (request, context) => {
      const requestId =
        request.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID()
      try {
        const api = await authenticatePublicApi(
          request,
          requestId,
          scope ?? undefined
        )
        const token: VerifiedApiToken = {
          tokenId: api.token.id,
          prefix: api.token.prefix,
          scopes: api.token.scopes as PublicApiScope[],
          expiresAt: api.token.expiresAt,
          ctx: {
            userId: api.userId,
            userName: api.userName,
            userEmail: api.userEmail,
            organizationId: api.organization.id,
            roles: api.roles,
            actor: api.actor,
          },
        }
        // Static routes have no params; Next still passes a context.
        const params = ((await context?.params) ?? {}) as TParams
        const response = await handler(token, request, params)
        for (const [name, value] of Object.entries(
          rateLimitHeaders(api.rate.limit, api.rate)
        )) {
          response.headers.set(name, value)
        }
        return response
      } catch (error) {
        if (error instanceof Error && "status" in error) {
          const status = (error as { status?: number }).status
          if (status && status >= 500) console.error(error)
        }
        return publicErrorResponse(error, requestId)
      }
    }
  )
}

/** Adds the projects-app link to each task (`{origin}/en/{slug}/projects/{id}?task=…`). */
export async function withTaskUrls<T extends { id: string; projectId: string }>(
  token: VerifiedApiToken,
  tasks: T[]
): Promise<(T & { url: string })[]> {
  const { slug } = await prisma.organization.findUniqueOrThrow({
    where: { id: token.ctx.organizationId },
    select: { slug: true },
  })
  const base = `${appOrigin("projects")}/en/${slug}/projects`
  return tasks.map((task) => ({
    ...task,
    url: `${base}/${task.projectId}?task=${task.id}`,
  }))
}

/** Reads a JSON body, or throws a 400. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AppError("bad_request", "The body must be valid JSON.")
  }
}
