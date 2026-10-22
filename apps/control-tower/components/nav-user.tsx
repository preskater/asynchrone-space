"use client"

import { useRouter } from "next/navigation"

import { EllipsisVerticalIcon, ExternalLink, LogOut } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { authClient } from "@/lib/auth-client"
import type { PlatformContext } from "@/lib/platform/guard"

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase()
}

export function NavUser({
  user,
  platformAppUrl,
  compact = false,
}: {
  user: PlatformContext
  platformAppUrl: string
  compact?: boolean
}) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const initials = getInitials(user.userName)
  const roleLabel = user.role.replace("platform_", "")

  async function signOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  const account = (
    <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
      <Avatar className="size-8">
        <AvatarImage alt={user.userName} />
        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-start text-sm leading-tight">
        <span className="truncate font-medium">{user.userName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {user.userEmail}
        </span>
        <Badge variant="secondary" className="mt-1 w-fit capitalize">
          {roleLabel}
        </Badge>
      </div>
    </div>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          {compact ? (
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={user.userName}
                />
              }
            >
              <Avatar className="size-7 rounded-full grayscale">
                <AvatarImage alt={user.userName} />
                <AvatarFallback className="rounded-full text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
          ) : (
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-muted"
                />
              }
            >
              <Avatar className="size-8 rounded-lg grayscale">
                <AvatarImage alt={user.userName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{user.userName}</span>
                <span className="truncate text-xs text-foreground/70">
                  {user.userEmail}
                </span>
              </div>
              <EllipsisVerticalIcon className="ms-auto size-4" />
            </DropdownMenuTrigger>
          )}
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                {account}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <a
                    href={platformAppUrl}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <ExternalLink />
                Open customer app
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
