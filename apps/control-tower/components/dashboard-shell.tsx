"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import {
  Building2,
  LayoutDashboard,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"

import type { PlatformContext } from "@/lib/platform/guard"

import { NavLink } from "./nav-link"
import { SignOutButton } from "./sign-out-button"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/audit", label: "Audit", icon: ScrollText },
  { href: "/ops", label: "Operations", icon: ServerCog },
]

export function DashboardShell({
  context,
  children,
}: {
  context: PlatformContext
  children: ReactNode
}) {
  const roleLabel = context.role.replace("platform_", "")

  return (
    <div className="flex min-h-svh bg-muted/20">
      <aside className="hidden w-64 shrink-0 flex-col border-e bg-sidebar md:flex">
        <Link
          href="/overview"
          className="flex h-14 items-center gap-2 border-b px-4 font-semibold"
        >
          <ShieldCheck className="size-5" />
          Control Tower
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="space-y-2 border-t p-3">
          <div className="space-y-1 px-2 text-xs">
            <p className="truncate font-medium">{context.userEmail}</p>
            <p className="text-muted-foreground capitalize">{roleLabel}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
          <Link href="/overview" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5" />
            Control Tower
          </Link>
          <Badge variant="outline" className="capitalize">
            {roleLabel}
          </Badge>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
