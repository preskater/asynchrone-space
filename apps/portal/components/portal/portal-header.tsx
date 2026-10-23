"use client"

import { useTranslations } from "next-intl"
import { Building2Icon, LogOutIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { signOutAction } from "@workspace/auth/actions"

import { PortalNav } from "./portal-nav"

export function PortalHeader({
  organizationName,
  clientName,
  userName,
}: {
  organizationName: string
  clientName: string
  userName: string
}) {
  const t = useTranslations("Portal")

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {organizationName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {t("clientSpace", { name: clientName })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {userName}
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOutIcon data-icon="inline-start" />
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
        <PortalNav />
      </div>
    </header>
  )
}
