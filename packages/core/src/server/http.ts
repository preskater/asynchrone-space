import { NextResponse } from "next/server"

import { type AppError } from "../errors"

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
