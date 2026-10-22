import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/lib/auth"

import { primaryPlatformRole, type PlatformRole } from "./roles"

export interface PlatformContext {
  userId: string
  userName: string
  userEmail: string
  role: PlatformRole
  sessionId: string
}

export class PlatformUnauthorizedError extends Error {
  constructor() {
    super("Sign in to the control tower to continue.")
    this.name = "PlatformUnauthorizedError"
  }
}

export class PlatformForbiddenError extends Error {
  constructor() {
    super("This account does not have a platform role.")
    this.name = "PlatformForbiddenError"
  }
}

interface SessionSnapshot {
  userId: string
  userName: string
  userEmail: string
  role: PlatformRole | null
  sessionId: string
}

async function readSession(): Promise<SessionSnapshot | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    role: primaryPlatformRole(session.user.role),
    sessionId: session.session.id,
  }
}

/** Returns the platform context, or null for anonymous/non-platform users. */
export async function getPlatformContext(): Promise<PlatformContext | null> {
  const snapshot = await readSession()
  if (!snapshot?.role) return null
  return { ...snapshot, role: snapshot.role }
}

interface RequireOptions {
  /** `page` redirects/404s; `action` throws so server actions fail cleanly. */
  surface?: "page" | "action"
}

/**
 * Guard for pages and server actions.
 *
 * Pages: anonymous visitors are redirected to `/sign-in`; authenticated users
 * without a platform role get `notFound()` so the surface is not confirmed.
 */
export async function requirePlatformContext(
  options: RequireOptions = {}
): Promise<PlatformContext> {
  const surface = options.surface ?? "page"
  const snapshot = await readSession()

  if (!snapshot) {
    if (surface === "action") throw new PlatformUnauthorizedError()
    redirect("/sign-in")
  }

  if (!snapshot.role) {
    if (surface === "action") throw new PlatformForbiddenError()
    notFound()
  }

  return { ...snapshot, role: snapshot.role }
}
