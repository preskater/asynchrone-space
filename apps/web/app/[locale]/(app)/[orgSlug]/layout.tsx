import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { OrganizationSync } from "@/components/organization/organization-sync"

import { auth } from "@/lib/auth"
import { appOrigin } from "@/lib/app-urls"
import { isPortalMember } from "@/lib/portal/context"

export default async function OrganizationLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string; orgSlug: string }>
}>) {
  const { locale, orgSlug } = await params

  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/sign-in")
  }

  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  })

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  const organization = organizations.find((org) => org.slug === orgSlug)

  if (!organization) {
    redirect(`/${organizations[0]?.slug}`)
  }

  // Client-portal members only ever see their portal.
  if (await isPortalMember(organization.id, session.user.id)) {
    redirect(`${appOrigin("portal")}/${locale}`)
  }

  const needsSync = session.session.activeOrganizationId !== organization.id

  return (
    <>
      {needsSync ? (
        <OrganizationSync
          needsSync={needsSync}
          organizationId={organization.id}
        />
      ) : null}
      {children}
    </>
  )
}
