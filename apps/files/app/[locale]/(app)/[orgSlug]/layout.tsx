import { getTranslations } from "next-intl/server"

import {
  AppearanceProvider,
  RecentsProvider,
  WorkspaceHeader,
  WorkspaceProvider,
  WorkspaceSidebar,
  type WorkspaceApp,
  type WorkspaceNavItem,
} from "@workspace/app-shell"
import { ImpersonationBanner } from "@workspace/app-shell/server"
import { appOrigin, appUrl } from "@workspace/core/app-urls"
import { getOrganizationAppearance } from "@workspace/appearance/server"
import { fileService, orgQuotaBytes } from "@workspace/files"
import { FilesProvider } from "@workspace/files/store"
import { projectService } from "@workspace/projects"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { FilesSidebar } from "@/components/files/files-sidebar"
import { FilesNavProvider } from "@/lib/workspace-nav"
import { resolveWorkspace } from "@/lib/workspace"

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; orgSlug: string }>
}) {
  const { locale, orgSlug } = await params
  const { session, organization, ctx } = await resolveWorkspace(orgSlug, locale)
  const t = await getTranslations("Sidebar")
  const common = await getTranslations("Common")

  const [appearance, filesData, projectData, storageQuotaBytes] = await Promise.all([
    getOrganizationAppearance(organization.id),
    fileService.list(ctx),
    projectService.list(ctx),
    orgQuotaBytes(organization.id),
  ])

  const apps: WorkspaceApp[] = [
    { key: "projects", title: t("projects"), href: appUrl("projects", { locale, orgSlug }) },
    { key: "messages", title: t("messages"), href: appUrl("messages", { locale, orgSlug }) },
    { key: "calendars", title: t("calendars"), href: appUrl("calendars", { locale, orgSlug }) },
    { key: "files", title: t("files"), href: appUrl("files", { locale, orgSlug }), active: true },
    { key: "crm", title: t("crm"), href: appUrl("crm", { locale, orgSlug }) },
    { key: "hr", title: t("hr"), href: appUrl("hr", { locale, orgSlug }) },
    { key: "copilot", title: t("assistant"), href: appUrl("copilot", { locale, orgSlug }) },
  ]
  const shell = appOrigin("web")
  const secondary: WorkspaceNavItem[] = [
    { title: t("settings"), href: `${shell}/${locale}/${orgSlug}/settings` },
    { title: t("search"), href: `${shell}/${locale}/${orgSlug}/search` },
    { title: t("feedback"), href: `${shell}/${locale}/${orgSlug}/feedback` },
    { title: t("getHelp"), href: `${shell}/${locale}/${orgSlug}/help` },
  ]
  const authBaseUrl = process.env.BETTER_AUTH_URL ?? ""

  return (
    <TooltipProvider>
      <WorkspaceProvider
        activeOrganizationId={session.session.activeOrganizationId}
        organizationId={organization.id}
        value={{ userId: ctx.userId, role: ctx.role, orgSlug, organizationId: organization.id, organizationName: organization.name, authBaseUrl, locale }}>
        <AppearanceProvider initialAppearance={appearance} userId={ctx.userId}>
          <RecentsProvider organizationId={organization.id}>
            <FilesProvider
              initialData={filesData}
              currentUserId={ctx.userId}
              organizationId={organization.id}
              storageQuotaBytes={storageQuotaBytes}
              members={projectData.members}
            >
              <FilesNavProvider>
                <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}>
                  <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow">{common("skipToContent")}</a>
                  <WorkspaceSidebar apps={apps} secondary={secondary} homeHref={appUrl("copilot", { locale, orgSlug })} contextual={<FilesSidebar />} />
                  <SidebarInset id="main-content">
                    {session.session.impersonatedBy ? <ImpersonationBanner name={session.user.name} stopUrl={`${authBaseUrl}/api/platform/stop-impersonating`} /> : null}
                    <WorkspaceHeader title={t("files")} apps={apps} currentApp="files" orgSlug={orgSlug} organizationName={organization.name} locale={locale} authBaseUrl={authBaseUrl} userName={session.user.name} />
                    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                  </SidebarInset>
                </SidebarProvider>
              </FilesNavProvider>
            </FilesProvider>
          </RecentsProvider>
        </AppearanceProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  )
}
