"use client"

import {
  BriefcaseIcon,
  CalendarIcon,
  CircleHelpIcon,
  CommandIcon,
  FileIcon,
  FolderIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { NavMain, type NavApp } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { OrgSwitcher } from "@/components/organization/org-switcher"
import { Link } from "@/i18n/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

function useNavMain(orgSlug: string): NavApp[] {
  const t = useTranslations("Sidebar")
  return [
    {
      title: t("dashboard"),
      url: `/${orgSlug}`,
      icon: <LayoutDashboardIcon />,
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
      title: t("hr"),
      url: `/${orgSlug}/hr`,
      icon: <BriefcaseIcon />,
    },
  ]
}

function useNavSecondary(orgSlug: string) {
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
      title: t("getHelp"),
      url: `/${orgSlug}/help`,
      icon: <CircleHelpIcon />,
    },
  ]
}

export function AppSidebar({
  user,
  orgSlug,
  activeOrganizationId,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string
    email: string
    image?: string | null
  }
  orgSlug: string
  activeOrganizationId: string | null
}) {
  const navMain = useNavMain(orgSlug)
  const navSecondary = useNavSecondary(orgSlug)
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
        <OrgSwitcher activeOrganizationId={activeOrganizationId} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
