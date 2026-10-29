import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { getActiveOrgSlug } from "@/lib/organization/paths"

export async function isAuthenticated() {
  const session = await auth.api.getSession({ headers: await headers() })
  return Boolean(session)
}

export async function getMarketingAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return {
      isAuthenticated: false,
      dashboardHref: "/sign-up",
      billingHref: "/sign-up",
    }
  }
  const slug = await getActiveOrgSlug()
  return {
    isAuthenticated: true,
    dashboardHref: slug ? `/${slug}` : "/onboarding",
    // Signed-in visitors upgrade from their workspace's billing tab.
    billingHref: slug ? `/${slug}/settings?tab=billing` : "/onboarding",
  }
}
