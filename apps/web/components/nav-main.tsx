"use client"

import * as React from "react"
import { CirclePlusIcon, MailIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { ProjectFormDialog } from "@/components/project/project-dialog"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar"

import { useMessaging } from "@/lib/messaging/store"
import { useOrgSlug } from "@/lib/organization/use-org-slug"
import { useRecents, type AppKey } from "@/lib/recents/store"

export interface NavApp {
  key?: AppKey
  title: string
  url: string
  icon: React.ReactNode
  /** Extra routes that should keep this item active (e.g. module tabs). */
  match?: string[]
}

export function NavMain({ items }: { items: NavApp[] }) {
  const t = useTranslations("Sidebar")
  const pathname = usePathname()
  const router = useRouter()
  const orgSlug = useOrgSlug()
  const { recents, setActive } = useRecents()
  const { unreadTotal } = useMessaging()

  function openRecent(app: NavApp, id: string) {
    if (!app.key) return
    setActive(app.key, id)
    router.push(app.url)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("workspace")}</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <ProjectFormDialog
              trigger={
                <SidebarMenuButton
                  tooltip={t("quickCreate")}
                  className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                >
                  <CirclePlusIcon />
                  <span>{t("quickCreate")}</span>
                </SidebarMenuButton>
              }
            />
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
              render={<Link href={`/${orgSlug}/messages`} prefetch={false} />}
              nativeButton={false}
            >
              <MailIcon />
              <span className="sr-only">{t("messages")}</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          {items.map((item) => {
            const entries = item.key ? recents[item.key].slice(0, 3) : []
            const active =
              pathname === item.url ||
              pathname.startsWith(`${item.url}/`) ||
              (item.match ?? []).some(
                (route) =>
                  pathname === route || pathname.startsWith(`${route}/`)
              )
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  render={<Link href={item.url} prefetch={false} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
                {item.key === "messages" && unreadTotal > 0 ? (
                  <SidebarMenuBadge>{unreadTotal}</SidebarMenuBadge>
                ) : null}
                {item.key && entries.length > 0 ? (
                  <SidebarMenuSub>
                    {entries.map((entry) => (
                      <SidebarMenuSubItem key={entry.id}>
                        <SidebarMenuSubButton
                          render={<button type="button" />}
                          onClick={() => openRecent(item, entry.id)}
                        >
                          <span className="truncate">{entry.label}</span>
                          {entry.hint ? (
                            <span className="ms-auto truncate text-xs text-sidebar-foreground/60">
                              {entry.hint}
                            </span>
                          ) : null}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
