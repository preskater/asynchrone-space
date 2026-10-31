import {
  INTERNAL_API_VERSION,
  type DeletionResult,
  type ExportPart,
} from "@workspace/contracts"

interface HttpErrorLike {
  status: number
  code: string
  message: string
}

function isHttpError(value: unknown): value is HttpErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { status?: unknown }).status === "number" &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  )
}

function envelope(app: string, data: unknown): Response {
  return Response.json(
    {
      data,
      meta: {
        app,
        version: INTERNAL_API_VERSION,
        requestId: crypto.randomUUID(),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

function error(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}

async function authorize(
  request: Request,
  check: (request: Request) => Promise<unknown>
): Promise<Response | null> {
  try {
    await check(request)
    return null
  } catch (cause) {
    if (isHttpError(cause)) {
      return error(cause.status, cause.code, cause.message)
    }
    return error(401, "unauthorized", "A valid service token is required")
  }
}

function idFrom(request: Request, name: string): string | null {
  return new URL(request.url).searchParams.get(name)
}

export interface SagaHttpOptions {
  app: string
  authorizeDelete: (request: Request) => Promise<unknown>
  authorizeExport: (request: Request) => Promise<unknown>
  deleteOrganization: (organizationId: string) => Promise<DeletionResult>
  deleteUser: (userId: string) => Promise<DeletionResult>
  exportOrganization: (organizationId: string) => Promise<ExportPart>
}

/** `DELETE /internal/v1/organizations/:id` (id passed as `organizationId`). */
export function createOrganizationDeletionHandler(options: SagaHttpOptions) {
  return async function DELETE(request: Request): Promise<Response> {
    const denied = await authorize(request, options.authorizeDelete)
    if (denied) return denied
    const organizationId = idFrom(request, "organizationId")
    if (!organizationId) {
      return error(400, "validation_error", "organizationId is required")
    }
    try {
      return envelope(
        options.app,
        await options.deleteOrganization(organizationId)
      )
    } catch (cause) {
      if (isHttpError(cause)) {
        return error(cause.status, cause.code, cause.message)
      }
      console.error("[saga] organization deletion failed", cause)
      return error(500, "internal_error", "Organization deletion failed")
    }
  }
}

/** `DELETE /internal/v1/users/:id` (id passed as `userId`). */
export function createUserDeletionHandler(options: SagaHttpOptions) {
  return async function DELETE(request: Request): Promise<Response> {
    const denied = await authorize(request, options.authorizeDelete)
    if (denied) return denied
    const userId = idFrom(request, "userId")
    if (!userId) return error(400, "validation_error", "userId is required")
    try {
      return envelope(options.app, await options.deleteUser(userId))
    } catch (cause) {
      if (isHttpError(cause)) {
        return error(cause.status, cause.code, cause.message)
      }
      console.error("[saga] user deletion failed", cause)
      return error(500, "internal_error", "User deletion failed")
    }
  }
}

/** `GET /internal/v1/organizations/:id/export`. */
export function createOrganizationExportHandler(options: SagaHttpOptions) {
  return async function GET(request: Request): Promise<Response> {
    const denied = await authorize(request, options.authorizeExport)
    if (denied) return denied
    const organizationId = idFrom(request, "organizationId")
    if (!organizationId) {
      return error(400, "validation_error", "organizationId is required")
    }
    try {
      return envelope(
        options.app,
        await options.exportOrganization(organizationId)
      )
    } catch (cause) {
      if (isHttpError(cause)) {
        return error(cause.status, cause.code, cause.message)
      }
      console.error("[saga] export part failed", cause)
      return error(500, "internal_error", "Export part failed")
    }
  }
}

/**
 * An export is only ready when every app part completed. A missing part or a
 * failed one keeps the archive unavailable.
 */
export function canMarkExportReady(
  parts: { status: string }[],
  expectedParts: number
): boolean {
  return (
    parts.length === expectedParts &&
    expectedParts > 0 &&
    parts.every((part) => part.status === "complete")
  )
}
