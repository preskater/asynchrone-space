import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AppearanceProvider } from "@workspace/app-shell"
import { appOrigin } from "@workspace/core/app-urls"
import { PortalHeader } from "@/components/portal/portal-header"

import { auth } from "@/lib/auth"
import { getOrganizationAppearance } from "@workspace/appearance/server"
import { getPortalContext } from "@workspace/portal/context"

export default async function PortalLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect(`${appOrigin("web")}/${locale}/sign-in`)
  }

  const ctx = await getPortalContext()

  if (!ctx) {
    // Signed in but not a portal user: send them back to the workspace shell.
    redirect(`${appOrigin("web")}/${locale}`)
  }

  const appearance = await getOrganizationAppearance(ctx.organizationId)

  return (
    <AppearanceProvider initialAppearance={appearance} userId={ctx.userId}>
      <div className="flex min-h-svh flex-col bg-muted/30">
        <PortalHeader
          organizationName={ctx.organizationName}
          clientName={ctx.clientName}
          userName={ctx.userName}
        />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </AppearanceProvider>
  )
}
