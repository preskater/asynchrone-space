import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "@/components/landing/page-header"
import { PricingSection } from "@/components/landing/pricing-section"
import { FaqSection } from "@/components/landing/faq-section"
import { FinalCta } from "@/components/landing/final-cta"

import { getMarketingAuth } from "@/lib/landing/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.pricing")
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  }
}

export default async function PricingPage() {
  const t = await getTranslations("Marketing.pricing")
  const {
    isAuthenticated: authenticated,
    dashboardHref,
    billingHref,
  } = await getMarketingAuth()

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <PricingSection
        isAuthenticated={authenticated}
        dashboardHref={dashboardHref}
        billingHref={billingHref}
      />
      <FaqSection />
      <FinalCta isAuthenticated={authenticated} dashboardHref={dashboardHref} />
    </>
  )
}
