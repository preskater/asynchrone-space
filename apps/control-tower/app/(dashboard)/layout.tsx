import { DashboardShell } from "@/components/dashboard-shell"
import { requirePlatformContext } from "@/lib/platform/guard"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const context = await requirePlatformContext()
  const platformAppUrl = (process.env.PLATFORM_APP_URL ?? "").replace(/\/$/, "")

  return (
    <DashboardShell context={context} platformAppUrl={platformAppUrl}>
      {children}
    </DashboardShell>
  )
}
