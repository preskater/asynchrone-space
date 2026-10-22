"use client"

import { useRouter } from "next/navigation"

import { LogOut } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={async () => {
        await authClient.signOut()
        router.push("/sign-in")
        router.refresh()
      }}
    >
      <LogOut />
      Sign out
    </Button>
  )
}
