import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Operations" }

export default async function OperationsPage() {
  await requirePlatformContext()

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Operations</h1>
      <p className="text-sm text-muted-foreground">
        Upload backlog, repository sync and auth health land in the next phase.
      </p>
    </div>
  )
}
