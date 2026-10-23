import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { appOrigin } from "@workspace/core/app-urls"

import { auth } from "@/lib/auth"

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`${appOrigin("web")}/${locale}/sign-in`)

  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  })
  if (organizations.length === 0) redirect(`${appOrigin("web")}/${locale}/onboarding`)

  const active =
    organizations.find(
      (org) => org.id === session.session.activeOrganizationId
    ) ?? organizations[0]!

  redirect(`/${locale}/${active.slug}/messages`)
}
