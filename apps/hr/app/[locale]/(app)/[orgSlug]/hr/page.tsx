import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { HrWorkspace } from "@/components/hr/hr-workspace"

import { auth } from "@/lib/auth"
import { getRequestContextForOrganization } from "@workspace/auth/server"
import { hrService } from "@workspace/hr"
import { prisma } from "@/lib/prisma"

export default async function HrPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/sign-in")
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  })

  if (!organization) {
    notFound()
  }

  const ctx = await getRequestContextForOrganization(organization.id)
  const [data, t] = await Promise.all([
    hrService.getOverview(ctx),
    getTranslations("AppPages"),
  ])

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("hrTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("hrDescription")}</p>
      </div>
      <HrWorkspace data={data} />
    </div>
  )
}
