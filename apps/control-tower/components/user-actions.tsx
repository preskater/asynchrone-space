"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Ban, LogIn, ShieldOff } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { startImpersonation } from "@/actions/impersonation"
import { revokeUserSessions, setUserBanned } from "@/actions/users"
import type { ActionResult } from "@/lib/platform/result"

export function UserActions({
  userId,
  banned,
  canImpersonate,
}: {
  userId: string
  banned: boolean
  canImpersonate: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [banOpen, setBanOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [impersonateOpen, setImpersonateOpen] = useState(false)

  function run(action: () => Promise<ActionResult>, close: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error)
        return
      }
      setReason("")
      close()
      router.refresh()
    })
  }

  function impersonate() {
    setError(null)
    startTransition(async () => {
      try {
        await startImpersonation({ userId })
      } catch {
        setError("Could not start impersonation.")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canImpersonate && !banned ? (
          <AlertDialog open={impersonateOpen} onOpenChange={setImpersonateOpen}>
            <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
              <LogIn />
              Impersonate
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Impersonate this user?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will be redirected to the customer app with a one-hour session
                  marked as impersonated. The handoff is single-use and audited.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={pending} onClick={impersonate}>
                  {pending ? "Opening…" : "Open session"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
            <ShieldOff />
            Revoke sessions
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke every session?</AlertDialogTitle>
              <AlertDialogDescription>
                This signs the account out of the customer app, the control tower
                and every connected client immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={() =>
                  run(() => revokeUserSessions({ userId }), () =>
                    setRevokeOpen(false)
                  )
                }
              >
                {pending ? "Revoking…" : "Revoke sessions"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={banOpen} onOpenChange={setBanOpen}>
          <AlertDialogTrigger
            render={
              <Button
                variant={banned ? "secondary" : "destructive"}
                size="sm"
              />
            }
          >
            <Ban />
            {banned ? "Unban" : "Ban"}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {banned ? "Unban this account?" : "Ban this account?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {banned
                  ? "The account will be able to sign in again."
                  : "Sign-in is blocked and every active session is revoked immediately."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {!banned ? (
              <Field>
                <FieldLabel htmlFor="ban-reason">Reason (optional)</FieldLabel>
                <Input
                  id="ban-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Visible to platform staff"
                />
              </Field>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={banned ? "default" : "destructive"}
                disabled={pending}
                onClick={() =>
                  run(
                    () => setUserBanned({ userId, banned: !banned, reason }),
                    () => setBanOpen(false)
                  )
                }
              >
                {pending ? "Saving…" : banned ? "Unban" : "Ban account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
