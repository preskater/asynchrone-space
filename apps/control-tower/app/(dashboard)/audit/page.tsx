import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Audit" }

export default async function AuditPage() {
  await requirePlatformContext()

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Audit</h1>
      <p className="text-sm text-muted-foreground">
        The cross-organization audit feed lands in the next phase.
      </p>
    </div>
  )
}
