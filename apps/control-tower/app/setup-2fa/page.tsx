import { redirect } from "next/navigation"

import { SetupTwoFactorForm } from "@/components/setup-two-factor-form"
import { requirePlatformSession } from "@/lib/platform/guard"

export const metadata = { title: "Two-factor setup" }

export default async function SetupTwoFactorPage() {
  const context = await requirePlatformSession({
    allowUnverifiedTwoFactor: true,
  })

  if (context.twoFactorEnabled) {
    redirect("/overview")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-lg space-y-5">
        <div className="space-y-1 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Presk
          </p>
          <h1 className="text-2xl font-semibold">Control Tower</h1>
        </div>
        <SetupTwoFactorForm />
      </div>
    </main>
  )
}
