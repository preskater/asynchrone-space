"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { ExternalLink, SearchIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { ThemeToggle } from "@workspace/ui/components/theme-toggle"

import type { PlatformContext } from "@/lib/platform/guard"

import { CommandMenu } from "./command-menu"
import { NavUser } from "./nav-user"

const TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/organizations": "Organizations",
  "/users": "Users",
  "/audit": "Audit",
  "/ops": "Operations",
}

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/organizations/")) return "Organization"
  if (pathname.startsWith("/users/")) return "User"
  return TITLES[pathname] ?? "Control Tower"
}

export function SiteHeader({
  context,
  platformAppUrl,
}: {
  context: PlatformContext
  platformAppUrl: string
}) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen((previous) => !previous)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ms-1" />
          <Separator
            orientation="vertical"
            className="mx-2 h-4 data-vertical:self-auto"
          />
          <h1 className="truncate text-base font-medium">
            {pageTitle(pathname)}
          </h1>
          <div className="ms-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setPaletteOpen(true)}
            >
              <SearchIcon />
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden rounded border px-1 font-sans text-[10px] md:inline">
                ⌘K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open customer app"
              nativeButton={false}
              render={
                <a
                  href={platformAppUrl}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink />
            </Button>
            <ThemeToggle ariaLabel="Toggle theme" />
            <NavUser
              user={context}
              platformAppUrl={platformAppUrl}
              compact
            />
          </div>
        </div>
      </header>
      <CommandMenu
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        platformAppUrl={platformAppUrl}
      />
    </>
  )
}
