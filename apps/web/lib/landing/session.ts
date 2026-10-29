import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getActiveOrgSlug } from "@/lib/organization/paths"

import type { BillingInterval } from "@/lib/billing/types"

/**
 * Statuses that already entitle the workspace to a paid plan, so the pricing
 * page offers "manage" instead of starting a second checkout.
 */
const BILLED_STATUSES = new Set(["active", "trialing", "past_due"])

async function hasPaidSubscription(slug: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { organization: { slug } },
    select: { plan: true, status: true, manualOverride: true },
  })
  if (!subscription) return false
  if (subscription.plan !== "team" && subscription.plan !== "enterprise") {
    return false
  }
  // A manual Enterprise contract has no provider status to check.
  return subscription.manualOverride || BILLED_STATUSES.has(subscription.status)
}

/**
 * Where a "get Team" click continues when checkout cannot start yet: sign-up
 * first, then onboarding creates a workspace, then billing starts the payment.
 * The `subscribe` intent survives both steps.
 */
function subscribeHref(base: string, wrapInRedirect: boolean) {
  const build = (interval: BillingInterval) => {
    const target = `${base}?subscribe=${interval}`
    return wrapInRedirect
      ? `/sign-up?redirect=${encodeURIComponent(target)}`
      : target
  }
  return { month: build("month"), year: build("year") }
}

export async function getMarketingAuth() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return {
      isAuthenticated: false,
      dashboardHref: "/sign-up",
      billingHref: "/sign-up",
      orgSlug: null,
      /** Checkout needs a session and a workspace, so a click signs up first. */
      canStartCheckout: false,
      hasPaidPlan: false,
      subscribeHref: subscribeHref("/onboarding", true),
    }
  }

  const slug = await getActiveOrgSlug()

  if (!slug) {
    return {
      isAuthenticated: true,
      dashboardHref: "/onboarding",
      billingHref: "/onboarding",
      orgSlug: null,
      canStartCheckout: false,
      hasPaidPlan: false,
      subscribeHref: subscribeHref("/onboarding", false),
    }
  }

  return {
    isAuthenticated: true,
    dashboardHref: `/${slug}`,
    billingHref: `/${slug}/settings?tab=billing`,
    orgSlug: slug,
    canStartCheckout: true,
    hasPaidPlan: await hasPaidSubscription(slug),
    subscribeHref: subscribeHref(`/${slug}/settings`, false),
  }
}
