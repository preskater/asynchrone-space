import { redirect } from "next/navigation"

import { appUrl } from "@/lib/app-urls"

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; orgSlug: string }>
}) {
  const { locale, orgSlug } = await params
  redirect(appUrl("copilot", { locale, orgSlug }))
}
