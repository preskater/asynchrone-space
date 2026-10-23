"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "./auth"

/**
 * Sign out of the shared customer session and return to the shell's sign-in
 * page. Feature apps use this so the browser never calls the auth server
 * cross-origin (ADR 0021).
 */
export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() }).catch(() => {})
  redirect(process.env.BETTER_AUTH_URL ?? "/")
}

/** Persist the active organization for the shared customer session. */
export async function setActiveOrganizationAction(organizationId: string) {
  await auth.api.setActiveOrganization({
    headers: await headers(),
    body: { organizationId },
  })
}
