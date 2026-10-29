"use client"

import * as React from "react"
import { CreditCardIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { createCheckoutSessionAction } from "@/actions/billing"
import { Button } from "@workspace/ui/components/button"

import { Link, useRouter } from "@/i18n/navigation"
import { unwrapActionResult } from "@/lib/core/action"
import type { BillingInterval } from "@/lib/billing/types"
import { useErrorTranslator } from "@/lib/i18n/errors"

/**
 * Team CTA on the marketing site: one click opens Stripe Checkout.
 *
 * Checkout needs a session and a workspace, so without both the CTA falls back
 * to a sign-up/onboarding link that carries the `subscribe` intent and starts
 * the payment once the workspace exists.
 */
export function TeamCheckoutButton({
  interval,
  canStartCheckout,
  subscribeHref,
  billingHref,
  className,
}: {
  interval: BillingInterval
  canStartCheckout: boolean
  subscribeHref: string
  /** Fallback when checkout cannot start (already subscribed, no keys, …). */
  billingHref: string
  className?: string
}) {
  const t = useTranslations("Pricing")
  const te = useErrorTranslator()
  const locale = useLocale()
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  if (!canStartCheckout) {
    return (
      <Button
        className={className}
        render={<Link href={subscribeHref} />}
        nativeButton={false}
      >
        {t("teamCtaCurrent")}
      </Button>
    )
  }

  async function start() {
    setPending(true)
    try {
      const { url } = unwrapActionResult(
        await createCheckoutSessionAction({ interval, locale })
      )
      window.location.assign(url)
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (
        code === "billing_subscription_exists" ||
        code === "billing_manual_contract" ||
        code === "billing_not_configured" ||
        code === "role_cannot_manage_billing"
      ) {
        // Nothing to buy here: send them where the state is explained.
        router.push(billingHref)
        setPending(false)
        return
      }
      toast.error(te(error))
      setPending(false)
    }
  }

  return (
    <Button className={className} disabled={pending} onClick={() => void start()}>
      <CreditCardIcon />
      {pending ? t("teamCtaRedirecting") : t("teamCtaCurrent")}
    </Button>
  )
}
