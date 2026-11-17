import {
  CORRELATION_HEADER,
  withObservedRoute,
} from "@workspace/observability/next"

import type { PublicApiScope } from "@workspace/contracts"

import {
  authenticatePublicApi,
  rateLimitHeaders,
  type PublicApiContext,
} from "./auth"
import { publicErrorResponse } from "./errors"

export interface PublicApiHandlerOptions<TContext> {
  /** Metric/log label, e.g. `GET /api/v1/projects`. */
  route: string
  scope?: PublicApiScope
  handler: (
    ctx: PublicApiContext,
    request: Request,
    context: TContext
  ) => Promise<Response> | Response
}

/** Adds the public headers shared by every success response. */
function decorate(response: Response, ctx: PublicApiContext): Response {
  const headers = new Headers(response.headers)
  headers.set("Cache-Control", "no-store")
  headers.set(CORRELATION_HEADER, ctx.requestId)
  for (const [name, value] of Object.entries(
    rateLimitHeaders(ctx.rate.limit, ctx.rate)
  )) {
    headers.set(name, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/** `{ data, meta: { requestId, ...meta } }`, the shape every endpoint returns. */
export function publicJson(
  data: unknown,
  ctx: PublicApiContext,
  meta: Record<string, unknown> = {},
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers)
  headers.set("Cache-Control", "no-store")
  return Response.json(
    { data, meta: { requestId: ctx.requestId, ...meta } },
    { ...init, headers }
  )
}

/** A list response with the cursor metadata. */
export function publicPage<T>(
  items: T[],
  nextCursor: string | null,
  ctx: PublicApiContext
): Response {
  return publicJson(items, ctx, {
    nextCursor,
    hasMore: nextCursor !== null,
  })
}

/**
 * Wraps a `/api/v1` route: authenticates the token, enforces the scope, adds
 * request-id/rate headers and maps every failure to the public error envelope.
 * A correlation id is minted here because `/api/*` bypasses the app proxy.
 */
export function withPublicApi<TContext = unknown>(
  options: PublicApiHandlerOptions<TContext>
): (request: Request, context: TContext) => Promise<Response> {
  const observed = withObservedRoute(
    { app: "copilot", route: options.route },
    async (request: Request, context: TContext) => {
      const requestId =
        request.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID()
      try {
        const ctx = await authenticatePublicApi(
          request,
          requestId,
          options.scope
        )
        return decorate(await options.handler(ctx, request, context), ctx)
      } catch (error) {
        return publicErrorResponse(error, requestId)
      }
    }
  )

  return async (request, context) => {
    const requestId =
      request.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID()
    const headers = new Headers(request.headers)
    headers.set(CORRELATION_HEADER, requestId)
    return observed(new Request(request, { headers }), context)
  }
}
