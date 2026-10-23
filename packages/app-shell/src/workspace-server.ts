import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  auth,
  contextForMember,
  IMPERSONATION_TTL_MS,
  isPortalMember,
} from "@workspace/auth/server"
import type { AppKey } from "@workspace/core/app-urls"
import { appOrigin } from "@workspace/core/app-urls"
import type { RequestContext } from "@workspace/core"
import { prisma } from "@workspace/db"

export interface WorkspaceResolution {
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>
  organization: { id: string; name: string; slug: string }
  ctx: RequestContext
}

/**
 * Resolve the signed-in user in the organization named by the URL.
 *
 * Redirects to the shell for sign-in, onboarding or organization selection,
 * to the portal for client-portal members, and to the same app under the
 * member's actual organization when the slug does not match.
 */
export async function resolveWorkspace(
  orgSlug: string,
  locale: string,
  options: { appKey: AppKey; fallbackPath?: string }
): Promise<WorkspaceResolution> {
  const shell = appOrigin("web")
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect(`${shell}/${locale}/sign-in`)
  }

  if (
    session.session.impersonatedBy &&
    Date.now() - new Date(session.session.createdAt).getTime() >
      IMPERSONATION_TTL_MS
  ) {
    await prisma.session
      .delete({ where: { id: session.session.id } })
      .catch(() => {})
    redirect(`${shell}/${locale}/sign-in?error=impersonation-expired`)
  }

  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  })

  if (organizations.length === 0) {
    redirect(`${shell}/${locale}/onboarding`)
  }

  const organization =
    organizations.find((org) => org.slug === orgSlug) ?? organizations[0]!

  if (organization.slug !== orgSlug) {
    const suffix = options.fallbackPath ?? ""
    redirect(
      `${appOrigin(options.appKey)}/${locale}/${organization.slug}${suffix}`
    )
  }

  if (await isPortalMember(organization.id, session.user.id)) {
    redirect(`${appOrigin("portal")}/${locale}`)
  }

  const ctx = await contextForMember(session.user, organization.id)

  return { session, organization, ctx }
}
