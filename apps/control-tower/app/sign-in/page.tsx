import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SignInForm } from "@/components/sign-in-form"
import { auth } from "@/lib/auth"
import { primaryPlatformRole } from "@/lib/platform/roles"

export const metadata = { title: "Sign in" }

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    const role = primaryPlatformRole(session.user.role)
    if (role) {
      redirect(session.user.twoFactorEnabled ? "/overview" : "/setup-2fa")
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-1 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Presk
          </p>
          <h1 className="text-2xl font-semibold">Control Tower</h1>
        </div>
        <SignInForm />
        <p className="text-center text-xs text-muted-foreground">
          Accounts are provisioned from the customer app.
        </p>
      </div>
    </main>
  )
}
