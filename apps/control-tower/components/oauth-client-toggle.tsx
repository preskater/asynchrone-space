"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components/button"

import { setOAuthClientDisabled } from "@/actions/organizations"

export function OAuthClientToggle({
  clientId,
  disabled,
  canManage,
}: {
  clientId: string
  disabled: boolean
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (!canManage) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setOAuthClientDisabled({ clientId, disabled: !disabled })
          router.refresh()
        })
      }
    >
      {pending ? "Saving…" : disabled ? "Enable" : "Disable"}
    </Button>
  )
}
