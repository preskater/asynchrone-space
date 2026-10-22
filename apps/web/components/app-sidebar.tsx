"use client"

import {
  BriefcaseIcon,
  CalendarIcon,
  CircleHelpIcon,
  CommandIcon,
  FileIcon,
  FolderIcon,
  HandshakeIcon,
  MessageSquareHeartIcon,
  MessageSquareIcon,
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { CalendarsSidebar } from "@/components/calendars/calendars-sidebar"
import { ConversationSidebar } from "@/components/messaging/conversation-sidebar"
import { FilesSidebar } from "@/components/files/files-sidebar"
import { NavMain, type NavApp } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { Link, usePathname } from "@/i18n/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

export function useNavMain(orgSlug: string): NavApp[] {
  const t = useTranslations("Sidebar")
  return [
    {
      title: t("assistant"),
      url: `/${orgSlug}`,
      icon: <SparklesIcon />,
    },
    {
      key: "projects",
      title: t("projects"),
      url: `/${orgSlug}/projects`,
      icon: <FolderIcon />,
    },
    {
      key: "messages",
      title: t("messages"),
      url: `/${orgSlug}/messages`,
      icon: <MessageSquareIcon />,
    },
    {
      key: "calendars",
      title: t("calendars"),
      url: `/${orgSlug}/calendars`,
      icon: <CalendarIcon />,
    },
    {
      key: "files",
      title: t("files"),
      url: `/${orgSlug}/files`,
      icon: <FileIcon />,
    },
    {
      title: t("crm"),
      url: `/${orgSlug}/clients`,
      icon: <HandshakeIcon />,
      match: [`/${orgSlug}/contacts`, `/${orgSlug}/deals`],
    },
    {
      title: t("hr"),
      url: `/${orgSlug}/hr`,
      icon: <BriefcaseIcon />,
    },
  ]
}

export function useNavSecondary(orgSlug: string) {
  const t = useTranslations("Sidebar")
  return [
    {
      title: t("settings"),
      url: `/${orgSlug}/settings`,
      icon: <Settings2Icon />,
    },
    {
      title: t("search"),
      url: `/${orgSlug}/search`,
      icon: <SearchIcon />,
    },
    {
      title: t("feedback"),
      url: `/${orgSlug}/feedback`,
      icon: <MessageSquareHeartIcon />,
    },
    {
      title: t("getHelp"),
      url: `/${orgSlug}/help`,
      icon: <CircleHelpIcon />,
    },
  ]
}

export function AppSidebar({
  orgSlug,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  orgSlug: string
}) {
  const pathname = usePathname()
  const navMain = useNavMain(orgSlug)
  const navSecondary = useNavSecondary(orgSlug)

  const prefix = `/${orgSlug}`
  const relative = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname

  const contextual =
    relative === "/messages" || relative.startsWith("/messages/") ? (
      <ConversationSidebar />
    ) : relative === "/files" || relative.startsWith("/files/") ? (
      <FilesSidebar />
    ) : relative === "/calendars" || relative.startsWith("/calendars/") ? (
      <CalendarsSidebar />
    ) : null

  if (contextual) {
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarContent>{contextual}</SidebarContent>
        <SidebarRail />
      </Sidebar>
    )
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href={`/${orgSlug}`} prefetch={false} />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Presk</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
