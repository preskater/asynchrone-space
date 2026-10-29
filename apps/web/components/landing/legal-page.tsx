import { getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/landing/section"
import type { LegalSlug } from "@/lib/landing/legal"

const LEGAL_STRUCTURE: Record<LegalSlug, { sections: number[] }> = {
  privacy: { sections: [2, 2, 1, 1, 1] },
  terms: { sections: [1, 1, 1, 1] },
  security: { sections: [2, 2, 2] },
  cookies: { sections: [1, 2, 1] },
}

export async function LegalPage({ slug }: { slug: LegalSlug }) {
  const t = await getTranslations("Marketing.legal")
  const tDoc = await getTranslations(`Legal.${slug}`)
  const structure = LEGAL_STRUCTURE[slug]

  return (
    <>
      <section className="border-b bg-muted/30 py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance">
              {tDoc("title")}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {tDoc("description")}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("lastUpdated", { date: tDoc("updated") })}
            </p>
          </div>
        </Container>
      </section>
      <Section className="py-16">
        <div className="mx-auto max-w-3xl">
          {structure.sections.map((paragraphCount, index) => {
            const sectionNumber = index + 1
            return (
              <div key={sectionNumber} className="mb-10">
                <h2 className="font-heading text-xl font-semibold tracking-tight">
                  {tDoc(`s${sectionNumber}h` as never)}
                </h2>
                {Array.from({ length: paragraphCount }, (_, bodyIndex) => (
                  <p
                    key={bodyIndex}
                    className="mt-3 leading-7 text-muted-foreground"
                  >
                    {tDoc(`s${sectionNumber}b${bodyIndex + 1}` as never)}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      </Section>
    </>
  )
}
