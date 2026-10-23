import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { AppearanceProvider } from "@/components/appearance/appearance-provider"
import { ImpersonationBanner } from "@/components/impersonation-banner"
import { NotificationBell } from "@/components/notifications/notification-bell"
import {
  WorkspaceHeader,
  WorkspaceProvider,
  WorkspaceSidebar,
  type WorkspaceApp,
  type WorkspaceNavItem,
} from "@workspace/app-shell"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { IMPERSONATION_TTL_MS } from "@/lib/platform/impersonation"
import { appOrigin, appUrl } from "@/lib/app-urls"
import { getOrganizationAppearance } from "@/lib/appearance/service"
import { getRequestContextForOrganization } from "@/lib/core/auth-context"
import { notificationService } from "@/lib/notifications"
import { isPortalMember } from "@/lib/portal/context"
import { RecentsProvider } from "@/lib/recents/store"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/sign-in")
  }

  // Impersonation is time-boxed even if Better Auth refreshes the session.
  if (
    session.session.impersonatedBy &&
    Date.now() - new Date(session.session.createdAt).getTime() >
      IMPERSONATION_TTL_MS
  ) {
    await prisma.session
      .delete({ where: { id: session.session.id } })
      .catch(() => {})
    redirect("/sign-in?error=impersonation-expired")
  }

  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  })

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  const organization =
    organizations.find(
      (org) => org.id === session.session.activeOrganizationId
    ) ?? organizations[0]!

  const locale = await getLocale()

  // Client-portal members belong on the portal app.
  if (await isPortalMember(organization.id, session.user.id)) {
    redirect(`${appOrigin("portal")}/${locale}`)
  }

  const ctx = await getRequestContextForOrganization(organization.id)
  const t = await getTranslations("Common")

  const [notificationData, appearance] = await Promise.all([
    notificationService.list(ctx),
    getOrganizationAppearance(organization.id),
  ])

  const tSidebar = await getTranslations("Sidebar")
  const apps: WorkspaceApp[] = [
    {
      key: "projects",
      title: tSidebar("projects"),
      href: appUrl("projects", { locale, orgSlug: organization.slug }),
    },
    {
      key: "messages",
      title: tSidebar("messages"),
      href: appUrl("messages", { locale, orgSlug: organization.slug }),
    },
    {
      key: "calendars",
      title: tSidebar("calendars"),
      href: appUrl("calendars", { locale, orgSlug: organization.slug }),
    },
    {
      key: "files",
      title: tSidebar("files"),
      href: appUrl("files", { locale, orgSlug: organization.slug }),
    },
    {
      key: "crm",
      title: tSidebar("crm"),
      href: appUrl("crm", { locale, orgSlug: organization.slug }),
    },
    {
      key: "hr",
      title: tSidebar("hr"),
      href: appUrl("hr", { locale, orgSlug: organization.slug }),
    },
    {
      key: "copilot",
      title: tSidebar("assistant"),
      href: appUrl("copilot", { locale, orgSlug: organization.slug }),
    },
  ]

  const authBaseUrl = process.env.BETTER_AUTH_URL ?? ""
  const secondary: WorkspaceNavItem[] = [
    { title: tSidebar("settings"), href: `/${locale}/${organization.slug}/settings` },
    { title: tSidebar("search"), href: `/${locale}/${organization.slug}/search` },
    { title: tSidebar("feedback"), href: `/${locale}/${organization.slug}/feedback` },
    { title: tSidebar("getHelp"), href: `/${locale}/${organization.slug}/help` },
  ]

  return (
    <TooltipProvider>
      <WorkspaceProvider
        activeOrganizationId={session.session.activeOrganizationId}
        organizationId={organization.id}
        value={{
          userId: ctx.userId,
          role: ctx.role,
          orgSlug: organization.slug,
          organizationId: organization.id,
          organizationName: organization.name,
          authBaseUrl,
          locale,
        }}
      >
        <AppearanceProvider initialAppearance={appearance} userId={ctx.userId}>
          <RecentsProvider organizationId={organization.id}>
            <SidebarProvider
              style={
                {
                  "--sidebar-width": "calc(var(--spacing) * 72)",
                  "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
              }
            >
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
              >
                {t("skipToContent")}
              </a>
              <WorkspaceSidebar
                apps={apps}
                secondary={secondary}
                homeHref={appUrl("copilot", { locale, orgSlug: organization.slug })}
              />
              <SidebarInset id="main-content">
                {session.session.impersonatedBy ? (
                  <ImpersonationBanner
                    name={session.user.name}
                    stopUrl="/api/platform/stop-impersonating"
                  />
                ) : null}
                <WorkspaceHeader
                  title={tSidebar("workspace")}
                  apps={apps}
                  currentApp="web"
                  orgSlug={organization.slug}
                  organizationName={organization.name}
                  locale={locale}
                  authBaseUrl={authBaseUrl}
                  userName={session.user.name}
                  notificationSlot={
                    <NotificationBell
                      orgSlug={organization.slug}
                      initial={notificationData}
                    />
                  }
                />
                <div className="flex flex-1 flex-col">
                  <div className="@container/main flex flex-1 flex-col gap-2">
                    {children}
                  </div>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </RecentsProvider>
        </AppearanceProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  )
}
