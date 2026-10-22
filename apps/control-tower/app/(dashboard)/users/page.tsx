import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Users" }

export default async function UsersPage() {
  await requirePlatformContext()

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Users</h1>
      <p className="text-sm text-muted-foreground">
        The read-only user directory lands in the next phase.
      </p>
    </div>
  )
}
