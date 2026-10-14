export type AppErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "bad_request"
  | "internal_error"

/**
 * Stable, translation-friendly codes for service specific errors. The client
 * maps these to `Errors.*` catalog keys (e.g. `role_cannot_modify_projects` ->
 * `Errors.roleCannotModifyProjects`). They are intentionally independent from
 * the HTTP-level {@link AppErrorCode}.
 */
export type ServiceErrorCode =
  | "role_cannot_modify_projects"
  | "role_cannot_manage_members"
  | "email_already_member"
  | "role_cannot_modify_files"
  | "file_permission_denied"
  | "storage_quota_exceeded"
  | "upload_offset_mismatch"
  | "upload_size_mismatch"
  | "upload_checksum_mismatch"
  | "role_cannot_modify_calendars"
  | "role_cannot_send_messages"
  | "label_color_already_used"
  | "role_cannot_modify_hr"
  | "role_cannot_manage_hr"
  | "leave_overlapping"
  | "leave_self_approval"
  | "leave_not_pending"
  | "role_cannot_modify_crm"
  | "role_cannot_manage_crm"
  | "role_cannot_export_crm"
  | "client_name_taken"
  | "contact_email_exists"
  | "custom_field_required"
  | "pipeline_is_default"
  | "pipeline_not_empty"
  | "stage_not_empty"
  | "stage_last_required"
  | "file_already_linked"
  | "file_in_trash"
  | "project_already_linked"
  | "project_not_linked"
  | "portal_invite_exists"
  | "portal_read_only"
  | "file_too_large"

export type ErrorCode = AppErrorCode | ServiceErrorCode

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 422,
  conflict: 409,
  bad_request: 400,
  internal_error: 500,
}

export interface AppErrorOptions {
  details?: unknown
  params?: Record<string, string | number>
  status?: number
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: unknown
  readonly params?: Record<string, string | number>

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = options.status ?? STATUS_BY_CODE[code as AppErrorCode] ?? 500
    this.details = options.details
    this.params = options.params
  }
}

/**
 * Options accepted by the concrete error subclasses so callers can attach a
 * stable `code` (and interpolation `params`) while keeping the English
 * `message` as a fallback.
 */
export interface CodedErrorOptions {
  code?: ErrorCode
  params?: Record<string, string | number>
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to do this.") {
    super("unauthorized", message, { status: 401 })
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = "You do not have permission to do this.",
    options: CodedErrorOptions = {}
  ) {
    super(options.code ?? "forbidden", message, {
      params: options.params,
      status: 403,
    })
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super("not_found", `${resource} was not found.`, {
      params: { resource },
      status: 404,
    })
    this.name = "NotFoundError"
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "The request was invalid.",
    details?: unknown,
    options: CodedErrorOptions = {}
  ) {
    super(options.code ?? "validation_error", message, {
      details,
      params: options.params,
      status: 422,
    })
    this.name = "ValidationError"
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "That change conflicts with existing data.",
    options: CodedErrorOptions = {}
  ) {
    super(options.code ?? "conflict", message, {
      params: options.params,
      status: 409,
    })
    this.name = "ConflictError"
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request.") {
    super("bad_request", message, { status: 400 })
    this.name = "BadRequestError"
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

interface ZodLikeError {
  name: string
  issues?: unknown
}

function isZodError(error: unknown): error is ZodLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ZodLikeError).name === "ZodError" &&
    "issues" in error
  )
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (isZodError(error)) {
    const issues = Array.isArray(error.issues) ? error.issues : []
    const first = issues.find(
      (issue): issue is { message: string } =>
        typeof (issue as { message?: unknown })?.message === "string"
    )
    return new ValidationError(
      first?.message ?? "The request was invalid.",
      error.issues
    )
  }
  if (error instanceof Error) {
    return new AppError("internal_error", error.message)
  }
  return new AppError("internal_error", "Something went wrong.")
}
