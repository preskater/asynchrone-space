import { DashboardShell } from "@/components/dashboard-shell"
import { requirePlatformContext } from "@/lib/platform/guard"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const context = await requirePlatformContext()
  return <DashboardShell context={context}>{children}</DashboardShell>
}
