"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { CheckIcon } from "lucide-react"

import { Section, SectionHeading } from "@/components/landing/section"
import { TeamCheckoutButton } from "@/components/landing/team-checkout-button"
import { Link } from "@/i18n/navigation"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { pricingTiers, type PricingTier } from "@/lib/landing/content"

const TIER_KEYS = ["starter", "team", "enterprise"] as const

function tierKey(index: number): (typeof TIER_KEYS)[number] {
  return TIER_KEYS[index] ?? "starter"
}

function PricingCard({
  tier,
  index,
  yearly,
  isAuthenticated,
  dashboardHref,
  billingHref,
  canStartCheckout,
  hasPaidPlan,
  subscribeHref,
}: {
  tier: PricingTier
  index: number
  yearly: boolean
  isAuthenticated: boolean
  dashboardHref: string
  billingHref: string
  canStartCheckout: boolean
  hasPaidPlan: boolean
  subscribeHref: { month: string; year: string }
}) {
  const t = useTranslations("Pricing")
  const tCta = useTranslations("Landing.cta")
  const key = tierKey(index)
  const isEnterprise = key === "enterprise"
  const isTeam = key === "team"
  const amount = yearly ? tier.yearly : tier.monthly
  const price = isEnterprise
    ? t("custom")
    : amount === 0
      ? t("free")
      : `$${amount}`
  // Team is the only self-serve plan: signed-in workspaces can pay right away
  // and still start the free trial from settings.
  const trialHref =
    isTeam && isAuthenticated && dashboardHref !== "/onboarding"
      ? `${dashboardHref}/settings`
      : null
  const ctaHref = isEnterprise
    ? "/contact"
    : isAuthenticated
      ? dashboardHref
      : "/sign-up"
  const ctaLabel = isEnterprise
    ? t("enterpriseCta")
    : isAuthenticated
      ? hasPaidPlan && isTeam
        ? t("teamCtaManage")
        : tCta("dashboard")
      : t(`${key}Cta` as never)

  const teamCta =
    isTeam && !hasPaidPlan ? (
      <div className="flex w-full flex-col gap-2">
        <TeamCheckoutButton
          className="w-full"
          interval={yearly ? "year" : "month"}
          canStartCheckout={isAuthenticated && canStartCheckout}
          subscribeHref={yearly ? subscribeHref.year : subscribeHref.month}
          billingHref={billingHref}
        />
        {trialHref ? (
          <Link
            href={trialHref}
            className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("teamCtaTrial")}
          </Link>
        ) : null}
      </div>
    ) : null

  return (
    <Card
      className={
        tier.featured
          ? "relative overflow-visible ring-2 ring-primary"
          : "relative"
      }
    >
      {tier.featured ? (
        <Badge className="absolute start-6 -top-2.5">{t("mostPopular")}</Badge>
      ) : null}
      <CardHeader>
        <CardTitle>{t(key)}</CardTitle>
        <CardDescription>{t(`${key}Description` as never)}</CardDescription>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="font-heading text-4xl font-semibold tracking-tight">
            {price}
          </span>
          {!isEnterprise ? (
            <span className="text-sm text-muted-foreground">
              {tier.monthly === 0 ? t("forever") : t("perUserMonth")}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex flex-col gap-2.5 text-sm">
          {tier.features.map((_, featureIndex) => (
            <li key={featureIndex} className="flex items-center gap-2">
              <CheckIcon className="size-4 shrink-0 text-primary" />
              {t(`${key}F${featureIndex + 1}` as never)}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {teamCta ?? (
          <div className="flex w-full flex-col gap-2">
            <Button
              className="w-full"
              variant={tier.featured ? "default" : "outline"}
              render={<Link href={ctaHref} />}
              nativeButton={false}
            >
              {ctaLabel}
            </Button>
            {isEnterprise ? (
              <Link
                href="/legal/dpa"
                className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("enterpriseLegalPack")}
              </Link>
            ) : null}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

export function PricingGrid({
  yearly,
  isAuthenticated,
  dashboardHref,
  billingHref,
  canStartCheckout,
  hasPaidPlan,
  subscribeHref,
}: {
  yearly: boolean
  isAuthenticated: boolean
  dashboardHref: string
  billingHref: string
  canStartCheckout: boolean
  hasPaidPlan: boolean
  subscribeHref: { month: string; year: string }
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {pricingTiers.map((tier, index) => (
        <PricingCard
          key={tierKey(index)}
          tier={tier}
          index={index}
          yearly={yearly}
          isAuthenticated={isAuthenticated}
          dashboardHref={dashboardHref}
          billingHref={billingHref}
          canStartCheckout={canStartCheckout}
          hasPaidPlan={hasPaidPlan}
          subscribeHref={subscribeHref}
        />
      ))}
    </div>
  )
}

export function PricingSection({
  isAuthenticated,
  dashboardHref,
  billingHref,
  canStartCheckout,
  hasPaidPlan,
  subscribeHref,
}: {
  isAuthenticated: boolean
  dashboardHref: string
  billingHref: string
  canStartCheckout: boolean
  hasPaidPlan: boolean
  subscribeHref: { month: string; year: string }
}) {
  const t = useTranslations("Pricing")
  const [yearly, setYearly] = React.useState(false)

  return (
    <Section id="pricing" className="bg-muted/30">
      <SectionHeading
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <div className="mt-8 flex justify-center">
        <ToggleGroup
          value={[yearly ? "yearly" : "monthly"]}
          onValueChange={(value) => setYearly(value[0] === "yearly")}
          spacing={0}
          className="rounded-lg bg-muted p-1"
        >
          <ToggleGroupItem value="monthly" variant="outline" size="sm">
            {t("monthly")}
          </ToggleGroupItem>
          <ToggleGroupItem value="yearly" variant="outline" size="sm">
            {t("yearly")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="mt-10">
        <PricingGrid
          yearly={yearly}
          isAuthenticated={isAuthenticated}
          dashboardHref={dashboardHref}
          billingHref={billingHref}
          canStartCheckout={canStartCheckout}
          hasPaidPlan={hasPaidPlan}
          subscribeHref={subscribeHref}
        />
      </div>
    </Section>
  )
}
