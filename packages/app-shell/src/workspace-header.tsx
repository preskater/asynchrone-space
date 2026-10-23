"use client"

import { signOutAction } from "@workspace/auth/actions"
import { ThemeToggle } from "@workspace/ui/components/theme-toggle"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import { ChevronsUpDownIcon, LogOutIcon, UserRoundIcon } from "lucide-react"

import { WORKSPACE_APP_ICONS, type WorkspaceAppIcon } from "./icons"
import type { WorkspaceApp } from "./workspace-sidebar"

export function WorkspaceHeader({
  title,
  apps,
  currentApp,
  orgSlug,
  organizationName,
  locale,
  authBaseUrl,
  userName,
  notificationSlot,
}: {
  title: string
  apps: WorkspaceApp[]
  currentApp: WorkspaceAppIcon
  orgSlug: string
  organizationName: string
  locale: string
  authBaseUrl: string
  userName: string
  notificationSlot?: React.ReactNode
}) {
  const t = useTranslations("Sidebar")
  const common = useTranslations("Common")
  const userMenu = useTranslations("UserMenu")
  const current = apps.find((app) => app.key === currentApp)
  const CurrentIcon = WORKSPACE_APP_ICONS[currentApp]
  const accountHref = `${authBaseUrl}/${locale}/${orgSlug}/settings/account`
  const selectOrgHref = `${authBaseUrl}/${locale}/select-organization`

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ms-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="gap-1.5" />}
          >
            <CurrentIcon className="size-4" />
            <span className="hidden text-sm font-medium sm:inline">
              {current?.title ?? title}
            </span>
            <ChevronsUpDownIcon className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("workspace")}</DropdownMenuLabel>
              {apps.map((app) => {
                const Icon = WORKSPACE_APP_ICONS[app.key]
                return (
                  <DropdownMenuItem key={app.key} render={<a href={app.href} />}>
                    <Icon />
                    <span>{app.title}</span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <h1 className="hidden truncate text-base font-medium sm:block">
          {title}
        </h1>
        <div className="ms-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <span className="max-w-40 truncate">{organizationName}</span>
              <ChevronsUpDownIcon className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem render={<a href={selectOrgHref} />}>
                {t("workspace")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href={accountHref} />}>
                <UserRoundIcon />
                <span>{userName}</span>
              </DropdownMenuItem>
              <form action={signOutAction}>
                <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                  <LogOutIcon />
                  <span>{userMenu("logOut")}</span>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
          {notificationSlot}
          <ThemeToggle ariaLabel={common("toggleTheme")} />
        </div>
      </div>
    </header>
  )
}
