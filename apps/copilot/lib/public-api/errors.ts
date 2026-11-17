import { DomainClientError } from "@workspace/contracts"
import { AppError } from "@workspace/core/errors"

import type { PublicApiErrorCode } from "@workspace/contracts"

const STATUS_BY_CODE: Record<PublicApiErrorCode, number> = {
  missing_token: 401,
  invalid_token: 401,
  expired_token: 401,
  revoked_token: 401,
  insufficient_scope: 403,
  organization_mismatch: 403,
  upgrade_required: 403,
  rate_limited: 429,
  validation_error: 422,
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  internal_error: 500,
}

/**
 * A gateway-level failure. Domain errors are mapped to this shape by
 * {@link toPublicApiError}; the envelope never exposes Prisma/pg internals.
 */
export class PublicApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown
  readonly headers: Record<string, string>

  constructor(
    code: PublicApiErrorCode | string,
    message: string,
    options: {
      status?: number
      details?: unknown
      headers?: Record<string, string>
    } = {}
  ) {
    super(message)
    this.name = "PublicApiError"
    this.code = code
    this.status =
      options.status ?? STATUS_BY_CODE[code as PublicApiErrorCode] ?? 500
    this.details = options.details
    this.headers = options.headers ?? {}
  }
}

export function missingToken(message = "A bearer token is required.") {
  return new PublicApiError("missing_token", message, {
    headers: { "WWW-Authenticate": "Bearer" },
  })
}

export function invalidToken(message = "The token is not valid.") {
  return new PublicApiError("invalid_token", message, {
    headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
  })
}

export function expiredToken(message = "The token has expired.") {
  return new PublicApiError("expired_token", message, {
    headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
  })
}

export function revokedToken(message = "The token has been revoked.") {
  return new PublicApiError("revoked_token", message, {
    headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
  })
}

export function insufficientScope(scope: string) {
  return new PublicApiError(
    "insufficient_scope",
    `This token lacks the ${scope} scope.`,
    {
      status: 403,
      headers: {
        "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"`,
      },
    }
  )
}

function isZodError(
  error: unknown
): error is { name: string; issues: unknown[] } {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "ZodError" &&
    Array.isArray((error as { issues?: unknown }).issues)
  )
}

function zodDetails(issues: unknown[]) {
  return issues.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return []
    const value = issue as { path?: unknown; message?: unknown }
    const path = Array.isArray(value.path)
      ? value.path.map(String).join(".")
      : ""
    return [{ path, message: String(value.message ?? "Invalid value") }]
  })
}

/** Maps every error the gateway can see to a stable public response. */
export function toPublicApiError(error: unknown): PublicApiError {
  if (error instanceof PublicApiError) return error

  if (error instanceof AppError) {
    const server = error.status >= 500
    return new PublicApiError(
      server ? "internal_error" : error.code,
      server ? "Something went wrong." : error.message,
      {
        status: error.status,
        details: server ? undefined : error.details,
        headers: error.retryAfter
          ? { "Retry-After": String(error.retryAfter) }
          : undefined,
      }
    )
  }

  if (isZodError(error)) {
    return new PublicApiError("validation_error", "The request was invalid.", {
      status: 422,
      details: zodDetails(error.issues),
    })
  }

  if (error instanceof DomainClientError) {
    if (error.status === 401 || error.status >= 500) {
      console.error("[public-api] domain call failed", error)
      return new PublicApiError("internal_error", "Something went wrong.", {
        status: 502,
      })
    }
    if (error.status === 422 || error.status === 400) {
      return new PublicApiError("validation_error", error.message, {
        status: error.status,
      })
    }
    return new PublicApiError(error.code, error.message, {
      status: error.status,
    })
  }

  console.error("[public-api] unhandled error", error)
  return new PublicApiError("internal_error", "Something went wrong.")
}

export function publicErrorResponse(
  error: unknown,
  requestId: string,
  extraHeaders: Record<string, string> = {}
): Response {
  const publicError = toPublicApiError(error)
  return Response.json(
    {
      error: {
        code: publicError.code,
        message: publicError.message,
        ...(publicError.details === undefined
          ? {}
          : { details: publicError.details }),
      },
      meta: { requestId },
    },
    {
      status: publicError.status,
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
        ...extraHeaders,
        ...publicError.headers,
      },
    }
  )
}
