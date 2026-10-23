"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

import { WORKSPACE_APP_ICONS, type WorkspaceAppIcon } from "./icons"

export interface WorkspaceApp {
  key: WorkspaceAppIcon
  title: string
  href: string
  active?: boolean
}

export interface WorkspaceNavItem {
  title: string
  href: string
  icon?: React.ReactNode
}

export function WorkspaceSidebar({
  apps,
  secondary = [],
  homeHref,
  quickCreate,
  footer,
  contextual,
}: {
  apps: WorkspaceApp[]
  secondary?: WorkspaceNavItem[]
  homeHref: string
  quickCreate?: React.ReactNode
  footer?: React.ReactNode
  /** Replaces the app navigation (used by Messages, Calendars, Files). */
  contextual?: React.ReactNode
}) {
  const t = useTranslations("Sidebar")

  if (contextual) {
    return (
      <Sidebar collapsible="offcanvas">
        <SidebarContent>{contextual}</SidebarContent>
        <SidebarRail />
      </Sidebar>
    )
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href={homeHref} />}
            >
              {WORKSPACE_APP_ICONS.web ? (
                <span aria-hidden className="size-5">
                  {React.createElement(WORKSPACE_APP_ICONS.web, {
                    className: "size-5",
                  })}
                </span>
              ) : null}
              <span className="text-base font-semibold">Presk</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {quickCreate}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {apps.map((app) => {
                const Icon = WORKSPACE_APP_ICONS[app.key]
                return (
                  <SidebarMenuItem key={app.key}>
                    <SidebarMenuButton
                      tooltip={app.title}
                      isActive={app.active}
                      render={<a href={app.href} />}
                    >
                      <Icon />
                      <span>{app.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {secondary.length > 0 ? (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {secondary.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<a href={item.href} />}>
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        {footer}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
