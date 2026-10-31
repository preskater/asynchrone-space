import { ArrowRightIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Container } from "@/components/landing/section"
import { Link } from "@workspace/i18n/navigation"
import { Button } from "@workspace/ui/components/button"

export async function FinalCta({
  isAuthenticated,
  dashboardHref,
}: {
  isAuthenticated: boolean
  dashboardHref: string
}) {
  const t = await getTranslations("Landing.cta")

  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16">
          <h2 className="mx-auto max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80 text-pretty">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Button
                size="lg"
                variant="secondary"
                render={<Link href={dashboardHref} />}
                nativeButton={false}
              >
                {t("dashboard")}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="secondary"
                  render={<Link href="/sign-up" />}
                  nativeButton={false}
                >
                  {t("startBuilding")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  render={<Link href="/sign-in" />}
                  nativeButton={false}
                >
                  {t("signIn")}
                </Button>
              </>
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}
