"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { updateOrganizationPlan } from "@/actions/organizations"

const MB = 1024 * 1024

const PLANS = ["free", "team", "enterprise"] as const
type Plan = (typeof PLANS)[number]

export function PlanForm({
  organizationId,
  plan,
  quotaBytes,
}: {
  organizationId: string
  plan: Plan
  quotaBytes: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [nextPlan, setNextPlan] = useState<Plan>(plan)
  const [quotaMb, setQuotaMb] = useState(
    quotaBytes ? String(Math.round(quotaBytes / MB)) : ""
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaved(false)

    const parsedMb = quotaMb.trim() === "" ? null : Number(quotaMb)
    if (parsedMb !== null && (!Number.isFinite(parsedMb) || parsedMb <= 0)) {
      setError("Quota must be a positive number of MB, or empty for the plan default.")
      return
    }

    startTransition(async () => {
      const result = await updateOrganizationPlan({
        organizationId,
        plan: nextPlan,
        quotaBytes: parsedMb === null ? null : Math.round(parsedMb * MB),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Plan
          <select
            value={nextPlan}
            onChange={(event) => setNextPlan(event.target.value as Plan)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground capitalize"
          >
            {PLANS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Quota override (MB)
          <Input
            inputMode="numeric"
            value={quotaMb}
            onChange={(event) => setQuotaMb(event.target.value)}
            placeholder="Plan default"
            className="w-40"
          />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-xs text-muted-foreground">Saved.</p> : null}
    </form>
  )
}
