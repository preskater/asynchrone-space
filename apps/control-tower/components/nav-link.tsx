"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { LucideIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: LucideIcon
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}
