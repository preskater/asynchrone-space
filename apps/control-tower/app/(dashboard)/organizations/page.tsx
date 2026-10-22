import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Organizations" }

export default async function OrganizationsPage() {
  await requirePlatformContext()

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Organizations</h1>
      <p className="text-sm text-muted-foreground">
        The read-only organization directory lands in the next phase.
      </p>
    </div>
  )
}
