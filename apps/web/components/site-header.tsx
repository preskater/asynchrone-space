"use client"

import { useTranslations } from "next-intl"

import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"

import { usePathname } from "@/i18n/navigation"
import { useProjectStore } from "@/lib/projects/store"

const titleKeys = {
  "": "dashboard",
  "/projects": "projects",
  "/messages": "messages",
  "/calendars": "calendars",
  "/files": "files",
  "/hr": "hr",
  "/settings/account": "account",
  "/settings": "settings",
  "/search": "search",
  "/help": "getHelp",
} as const satisfies Record<string, string>

function usePageTitle(orgSlug: string, pathname: string) {
  const t = useTranslations("Sidebar")
  const { getProject } = useProjectStore()

  const prefix = `/${orgSlug}`
  const relative = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname

  const titleKey = titleKeys[relative as keyof typeof titleKeys]
  if (titleKey !== undefined) return t(titleKey)
  if (relative.startsWith("/projects/")) {
    const projectId = relative.split("/")[2]
    return projectId ? (getProject(projectId)?.name ?? t("projects")) : t("projects")
  }
  return t("dashboard")
}

export function SiteHeader({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname()
  const title = usePageTitle(orgSlug, pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ms-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ms-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
