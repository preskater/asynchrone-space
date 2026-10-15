import { NextResponse } from "next/server"

import { toAppError, type AppError } from "./errors"

/**
 * Serialise an error for the client. 5xx responses are sanitised: the raw
 * message (which can carry Prisma/pg internals) is logged server-side only and
 * replaced with a generic string.
 */
export function jsonError(error: AppError) {
  const server = error.status >= 500
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: server ? "Something went wrong." : error.message,
        params: server ? undefined : error.params,
        details: server ? undefined : error.details,
      },
    },
    { status: error.status }
  )
}

export function handle<T extends unknown[]>(
  fn: (...args: T) => Promise<Response | unknown>
) {
  return async (...args: T): Promise<Response> => {
    try {
      const result = await fn(...args)
      if (result instanceof Response) return result
      return NextResponse.json(result ?? null)
    } catch (error) {
      const appError = toAppError(error)
      if (appError.status >= 500) console.error(appError)
      return jsonError(appError)
    }
  }
}
