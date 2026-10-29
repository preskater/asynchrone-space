import { HeroSection } from "@/components/landing/hero-section"
import { LogoCloud } from "@/components/landing/logo-cloud"
import { FeatureGrid } from "@/components/landing/feature-grid"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { Testimonials } from "@/components/landing/testimonials"
import { PricingPreview } from "@/components/landing/pricing-preview"
import { FinalCta } from "@/components/landing/final-cta"

import { getMarketingAuth } from "@/lib/landing/session"

export default async function HomePage() {
  const {
    isAuthenticated: authenticated,
    dashboardHref,
    billingHref,
  } = await getMarketingAuth()

  return (
    <>
      <HeroSection isAuthenticated={authenticated} dashboardHref={dashboardHref} />
      <LogoCloud />
      <FeatureGrid limit={3} showCta />
      <ProductShowcase />
      <Testimonials />
      <PricingPreview
        isAuthenticated={authenticated}
        dashboardHref={dashboardHref}
        billingHref={billingHref}
      />
      <FinalCta isAuthenticated={authenticated} dashboardHref={dashboardHref} />
    </>
  )
}
