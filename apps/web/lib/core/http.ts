import { NextResponse } from "next/server"

import { ForbiddenError, type AppError } from "./errors"

/**
 * CSRF guard for cookie-authenticated REST mutations. Server actions get an
 * Origin check from Next.js; route handlers do not, and SameSite=Lax alone
 * still lets same-site (e.g. sibling subdomain) pages post. Returns a 403
 * response when the request comes from another origin, otherwise null.
 * Requests without Origin/Sec-Fetch-Site are non-browser clients, which cannot
 * ride a victim's cookie, so they pass.
 */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin")
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  let crossOrigin: boolean
  if (origin) {
    try {
      crossOrigin = new URL(origin).host !== host
    } catch {
      // Opaque origins ("null" from sandboxed frames) are never same-origin.
      crossOrigin = true
    }
  } else {
    const site = request.headers.get("sec-fetch-site")
    crossOrigin = site === "cross-site" || site === "same-site"
  }
  return crossOrigin ? jsonError(new ForbiddenError()) : null
}

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
