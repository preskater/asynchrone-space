"use client"

import type { CSSProperties, ReactNode } from "react"

import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import type { PlatformContext } from "@/lib/platform/guard"

import { AppSidebar } from "./app-sidebar"
import { SiteHeader } from "./site-header"

export function DashboardShell({
  context,
  platformAppUrl,
  children,
}: {
  context: PlatformContext
  platformAppUrl: string
  children: ReactNode
}) {
  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <AppSidebar
          context={context}
          platformAppUrl={platformAppUrl}
          variant="inset"
        />
        <SidebarInset id="main-content">
          <SiteHeader context={context} platformAppUrl={platformAppUrl} />
          <main className="flex flex-1 flex-col px-4 py-4 md:py-6 lg:px-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
